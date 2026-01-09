# FilesController.putMove() 호출 관련 쿼리 분석 및 최적화

files에서 이동/복사를 진행할 때 사용되는 FilesController.putMove()를 호출했을 때 수행되는 쿼리의 실행 계획을 대략적으로 분석해 보았습니다.

분석 기준:
- transaction 내에 각 쿼리가 포함되는 것이 합리적인가
- 쿼리 계획이 충분히 효율적인가

참고 사항: 

- 상황에 따라 실행 되는 쿼리를 순서 대로 나열하며 분석했으며, 복사, 이동 등 여러 상황이 가능하기 때문에 쿼리에 등장하는 숫자, 이름 등의 값들은 한 transaction 내에서 일관성이 없을 수도 있습니다.

- putMove()가 호출하는 함수에서 사용되는 쿼리의 경우 호출되는 함수의 이름을 주석의 형태로 쿼리 위에 기재했습니다. 모든 함수는 작성 당시 기준으로 FilesService에 속해 있습니다. (이후 FilesService가 두 개의 class로 분리될 가능성이 있습니다.)

- 좁은 화면에서의 가독성을 조금이나마 향상시키기 위해 각 표에서 하나의 열을 삭제하거나 너비를 줄였습니다.

## (참고) file 테이블의 키 (인덱스)

이 함수의 경우 거의 모든 쿼리가 file 테이블을 접속하며, file 테이블의 키 (인덱스)는 다음과 같습니다.

```
primary key (user_serial, parent_serial, type, file_name)

unique key file_serial (file_serial)

foreign key file_ibfk_1 (user_serial) references user (user_serial)

foreign key file_ibfk_2 (parent_serial) references file (file_serial)

key user_serial (user_serial, mark)

key user_serial_2 (user_serial, copy_origin) // 이번 분석을 통해 새로 추가

// key user_serial_3 (user_serial, file_serial) // 이번 분석 과정에서 추가 시도 후 삭제
```

## 접근 가능성 확인

```
// checkAccess
select file_serial from file where user_serial=20 and file_serial=1047 and type='dir' and (file_name='files' or issys='false')
+----+-------------+-------+------------+-------+-----------------------------------------------+-------------+---------+-------+------+----------+-------+
| id | select_type | table | partitions | type  | possible_keys                                 | key         | key_len | ref   | rows | filtered | Extra |
+----+-------------+-------+------------+-------+-----------------------------------------------+-------------+---------+-------+------+----------+-------+
|  1 | SIMPLE      | file  | NULL       | const | PRIMARY,file_serial,user_serial,user_serial_2 | file_serial | 8       | const |    1 |   100.00 | NULL  |
+----+-------------+-------+------------+-------+-----------------------------------------------+-------------+---------+-------+------+----------+-------+
```
이 부분은 파일을 복사/이동시키려는 폴더가 사용자가 소유한 폴더가 맞는지 확인하는 부분입니다. file_serial를 인덱스로 const 방법을 통해 접속했음을 알 수 있습니다. const 방법으로 빠르고 효과적인 접근임을 알 수 있습니다. 또한 폴더 및 파일의 소유권이 바뀌는 일은 없으므로 transaction 바깥에서 소유권을 확인하도록 수정했습니다.

## 폴더 정보 수집

여기서부터 transaction이 시작됩니다.

폴더의 정보를 수집하는 부분입니다. checkTimestamp는 코드 상으로는 존재하지만 클라이언트에서 항상 ignoreTimestamp를 true로 설정하므로 사실상 실행되지 않으므로 쿼리를 생략했습니다.

이동 작업의 경우 폴더가 하위 폴더로 이동되면 폴더의 종속 관계가 순환 형태가 되어 root 폴더인 files로부터 해당 폴더를 접속할 수 없게 됩니다. 따라서 목적지 폴더의 상위 폴더 중에 이동 대상 폴더가 있는지 확인하기 위해, 명령이 '복사'가 아닌 '이동'일 경우 실행되는 getDirInfo에서는 이동 목적지 폴더의 상위 폴더들을 확인합니다.

다른 명령이 폴더를 이동하기 직전에 getDirInfo가 호출되고 이동 직후에 나머지 명령이 수행되면 순환 형태가 발생할 수 있으므로 이 쿼리는 transaction에 포함됩니다.

user_serial_3 (user_serial, file_serial)을 추가하기 전, 후의 쿼리 계획을 비교한 결과 둘 모두 file_serial (file_serial)을 사용하는 것을 확인할 수 있습니다. 따라서 user_serial, file_serial이 함께 탐색되는 경우 user_serial_3이 필요하지 않다는 것을 알 수 있습니다.

root 폴더인 files까지 반복 실행되는 쿼리이지만 const로 탐색되므로 효율적이라고 판단됩니다.

```
start transaction
// checkTimestamp: ignoreTimestamp is always set to true, and thus bypassed

// getDirInfo: run when action = move
select parent_serial, file_name, last_renamed, issys from file where user_serial=20 and file_serial=359 for share
(repeated with file_serial set to parent_serial)
+----+-------------+-------+------------+-------+-------------+---------+-------+------+----------+-------+
| id | select_type | table | partitions | type  | key         | key_len | ref   | rows | filtered | Extra |
+----+-------------+-------+------------+-------+-------------+---------+-------+------+----------+-------+
|  1 | SIMPLE      | file  | NULL       | const | file_serial | 8       | const |    1 |   100.00 | NULL  |
+----+-------------+-------+------------+-------+-------------+---------+-------+------+----------+-------+
// after: key(user_serial, file_serial),
+----+-------------+-------+------------+-------+-------------+---------+-------+------+----------+-------+
| id | select_type | table | partitions | type  | key         | key_len | ref   | rows | filtered | Extra |
+----+-------------+-------+------------+-------+-------------+---------+-------+------+----------+-------+
|  1 | SIMPLE      | file  | NULL       | const | file_serial | 8       | const |    1 |   100.00 | NULL  |
+----+-------------+-------+------------+-------+-------------+---------+-------+------+----------+-------+
+-----------------+-----------+-------------+-------------+-----------+---------------+-------------+-----------------------------------------------------------+
| trx_id          | THREAD_ID | OBJECT_NAME | INDEX_NAME  | LOCK_TYPE | LOCK_MODE     | LOCK_STATUS | LOCK_DATA                                                 |
+-----------------+-----------+-------------+-------------+-----------+---------------+-------------+-----------------------------------------------------------+
| 410432968813784 |       202 | file        | NULL        | TABLE     | IS            | GRANTED     | NULL                                                      |
| 410432968813784 |       202 | file        | file_serial | RECORD    | S,REC_NOT_GAP | GRANTED     | 359, 20, 1, 1, 'files                                   ' |
| 410432968813784 |       202 | file        | PRIMARY     | RECORD    | S,REC_NOT_GAP | GRANTED     | 20, 1, 1, 'files                                   '      |
+-----------------+-----------+-------------+-------------+-----------+---------------+-------------+-----------------------------------------------------------+
```

## 파일들의 이름 추출

클라이언트-서버 간 통신에서는 파일 이름보다는 대부분의 경우 파일 일련번호가 사용됩니다. 그러나 복사/이동 목적지에 동일한 이름의 파일이 있는 경우 추가 조치가 필요하므로 파일 이름을 추출하는 작업이 진행됩니다.

(type, file_name)이 중복되면 안 되는 상황이므로 type까지 함께 추출됩니다. 또한 실패한 파일이 있는 경우 실패 목록에 추가해야 하므로 파일 식별자인 (file_serial, last_renamed)도 함께 추출합니다.

(file_serial, last_renamed)로 인덱스를 구성해 보았으나 여전히 file_serial을 선택하는 것을 확인할 수 있었습니다.

파일들의 이름이 작업 중간에 바뀌는 경우 (type, file_name)의 unique key로 인해 작업이 실패하므로 이 작업도 transaction에 포함됩니다.

file_serial을 통한 range를 탐색이며 인덱스로 Using index condition을 수행하며, file_serial 및 primary index에 포함되지 않은 last_renamed를 제외하고는 모두 index로 처리할 수 있으므로 효율적일 것으로 판단됩니다. 특히 file_serial가 unique하므로 file_serial당 last_renamed는 한 번만 등장하기 때문에 과다한 탐색이 발생하지 않는다는 것을 알 수 있습니다.

이 경우에도 앞과 마찬가지로 file_serial_3 (user_serial, file_serial)이 사용되지 않았음을 확인할 수 있습니다.

이동의 경우 parent_serial이 바뀌는 레코드들이므로 for update를 적용했고, 복사의 경우 parent_serial에 변동이 없으므로 for share를 적용하도록 수정했습니다 (아래 코드에는 없음).

```
// moveFiles_getName
select file_serial, last_renamed, type, file_name from file where user_serial=20 and parent_serial=359 and (file_serial, last_renamed) in ((1046, '2026-01-08 14:16:54.000'), (1013, '2026-01-08 11:16:43.000')) and issys='false' for update
+----+-------------+-------+------------+-------+-------------+---------+------+------+----------+------------------------------------+
| id | select_type | table | partitions | type  | key         | key_len | ref  | rows | filtered | Extra                              |
+----+-------------+-------+------------+-------+-------------+---------+------+------+----------+------------------------------------+
|  1 | SIMPLE      | file  | NULL       | range | file_serial | 8       | NULL |    2 |     5.00 | Using index condition; Using where |
+----+-------------+-------+------------+-------+-------------+---------+------+------+----------+------------------------------------+
// after: key(user_serial, file_serial),
+----+-------------+-------+------------+-------+-------------+---------+------+------+----------+------------------------------------+
| id | select_type | table | partitions | type  | key         | key_len | ref  | rows | filtered | Extra                              |
+----+-------------+-------+------------+-------+-------------+---------+------+------+----------+------------------------------------+
|  1 | SIMPLE      | file  | NULL       | range | file_serial | 8       | NULL |    2 |     5.00 | Using index condition; Using where |
+----+-------------+-------+------------+-------+-------------+---------+------+------+----------+------------------------------------+
+--------+-----------+-------------+-------------+-----------+---------------+-------------+-----------------------------------+
| trx_id | THREAD_ID | OBJECT_NAME | INDEX_NAME  | LOCK_TYPE | LOCK_MODE     | LOCK_STATUS | LOCK_DATA                         |
+--------+-----------+-------------+-------------+-----------+---------------+-------------+-----------------------------------+
|  57004 |       202 | file        | NULL        | TABLE     | IS            | GRANTED     | NULL                              |
|  57004 |       202 | file        | NULL        | TABLE     | IX            | GRANTED     | NULL                              |
|  57004 |       202 | file        | file_serial | RECORD    | X,REC_NOT_GAP | GRANTED     | 1013, 20, 359, 2, '04           ' |
|  57004 |       202 | file        | file_serial | RECORD    | X,REC_NOT_GAP | GRANTED     | 1046, 20, 359, 1, '1학기      '   |
|  57004 |       202 | file        | file_serial | RECORD    | S,REC_NOT_GAP | GRANTED     | 359, 20, 1, 1, 'files        '    |
|  57004 |       202 | file        | PRIMARY     | RECORD    | X,REC_NOT_GAP | GRANTED     | 20, 359, 1, '1학기      '         |
|  57004 |       202 | file        | PRIMARY     | RECORD    | X,REC_NOT_GAP | GRANTED     | 20, 359, 2, '04           '       |
|  57004 |       202 | file        | PRIMARY     | RECORD    | S,REC_NOT_GAP | GRANTED     | 20, 1, 1, 'files        '         |
+--------+-----------+-------------+-------------+-----------+---------------+-------------+-----------------------------------+
```

## 중복된 이름 추출

parent_serial을 통해 range로 탐색되므로 효율적으로 판단됩니다. parent_serial 키와 primary key의 요소만을 통해서도 모든 조건을 판단할 수 있으므로 Using index임을 확인할 수 있습니다.

역시 중간에 파일 이름이 바뀌면 문제가 발생하므로 transaction 내부에 존재하며, overwrite 모드인 경우 파일이 삭제되므로 for update로 쿼리를 구성했습니다. 실제로 목적지인 1047번 폴더 소속의 이름이 겹치는 파일인 '1학기'의 경우 "1047, 20, 1, '1학기...'"가 next key lock인 X로 잠겼음을 확인할 수 있습니다.

```
// getting type, file_name of files with the same name.
select type, file_name from file where user_serial=20 and parent_serial=1047 and (type, file_name) in (('dir', '1학기'), ('file', '1')) for update
+----+-------------+-------+------------+-------+---------------+---------+------+------+----------+--------------------------+
| id | select_type | table | partitions | type  | key           | key_len | ref  | rows | filtered | Extra                    |
+----+-------------+-------+------------+-------+---------------+---------+------+------+----------+--------------------------+
|  1 | SIMPLE      | file  | NULL       | range | parent_serial | 173     | NULL |    2 |   100.00 | Using where; Using index |
+----+-------------+-------+------------+-------+---------------+---------+------+------+----------+--------------------------+
+--------+-----------+-------------+---------------+-----------+---------------+-------------+------------------------------------+
| trx_id | THREAD_ID | OBJECT_NAME | INDEX_NAME    | LOCK_TYPE | LOCK_MODE     | LOCK_STATUS | LOCK_DATA                          |
+--------+-----------+-------------+---------------+-----------+---------------+-------------+------------------------------------+
|  57008 |       202 | file        | NULL          | TABLE     | IS            | GRANTED     | NULL                               |
|  57008 |       202 | file        | NULL          | TABLE     | IX            | GRANTED     | NULL                               |
|  57008 |       202 | file        | parent_serial | RECORD    | X,GAP         | GRANTED     | 1048, 20, 2, '01            '      |
|  57008 |       202 | file        | parent_serial | RECORD    | X,GAP         | GRANTED     | 1047, 20, 1, '예비 폴더 '          |
|  57008 |       202 | file        | parent_serial | RECORD    | X             | GRANTED     | 1047, 20, 1, '1학기       '        |
|  57008 |       202 | file        | file_serial   | RECORD    | X,REC_NOT_GAP | GRANTED     | 1013, 20, 359, 2, '04            ' |
|  57008 |       202 | file        | file_serial   | RECORD    | X,REC_NOT_GAP | GRANTED     | 1046, 20, 359, 1, '1학기       '   |
|  57008 |       202 | file        | file_serial   | RECORD    | S,REC_NOT_GAP | GRANTED     | 359, 20, 1, 1, 'files         '    |
|  57008 |       202 | file        | PRIMARY       | RECORD    | X,REC_NOT_GAP | GRANTED     | 20, 1047, 1, '1학기       '        |
|  57008 |       202 | file        | PRIMARY       | RECORD    | X,REC_NOT_GAP | GRANTED     | 20, 359, 1, '1학기       '         |
|  57008 |       202 | file        | PRIMARY       | RECORD    | X,REC_NOT_GAP | GRANTED     | 20, 359, 2, '04            '       |
|  57008 |       202 | file        | PRIMARY       | RECORD    | S,REC_NOT_GAP | GRANTED     | 20, 1, 1, 'files         '         |
+--------+-----------+-------------+---------------+-----------+---------------+-------------+------------------------------------+
```

## 중복된 이름에 속하는 이동 대상 파일의 일련번호 등 정보 추출

primary key로 range 탐색을 하므로 효율적이라고 판단됩니다. 이 작업 이후 이름이 바뀌면 문제가 발생할 수 있으므로 transaction에 포함됩니다.

이동의 경우 여기에서 선택된 파일은 parent_serial이 변경되므로 for update로 읽기를 진행합니다. 복사의 경우 for share로 수정했습니다 (아래 코드에는 없음).

```
// if any file had the same name, below is run to get the file-to-move in problem 
select file_serial, type, file_name, last_renamed as timestamp, last_modified as modif from file where user_serial=20 and parent_serial=359 and (type, file_name) in (('dir', '1학기'), ('file', '1')) for update
+----+-------------+-------+------------+-------+---------+---------+------+------+----------+-------------+
| id | select_type | table | partitions | type  | key     | key_len | ref  | rows | filtered | Extra       |
+----+-------------+-------+------------+-------+---------+---------+------+------+----------+-------------+
|  1 | SIMPLE      | file  | NULL       | range | PRIMARY | 173     | NULL |    2 |   100.00 | Using where |
+----+-------------+-------+------------+-------+---------+---------+------+------+----------+-------------+
+--------+-----------+-------------+---------------+-----------+---------------+-------------+------------------------------------+
| trx_id | THREAD_ID | OBJECT_NAME | INDEX_NAME    | LOCK_TYPE | LOCK_MODE     | LOCK_STATUS | LOCK_DATA                          |
+--------+-----------+-------------+---------------+-----------+---------------+-------------+------------------------------------+
|  57008 |       202 | file        | NULL          | TABLE     | IS            | GRANTED     | NULL                               |
|  57008 |       202 | file        | NULL          | TABLE     | IX            | GRANTED     | NULL                               |
|  57008 |       202 | file        | parent_serial | RECORD    | X,GAP         | GRANTED     | 1048, 20, 2, '01            '      |
|  57008 |       202 | file        | parent_serial | RECORD    | X,GAP         | GRANTED     | 1047, 20, 1, '예비 폴더 '          |
|  57008 |       202 | file        | parent_serial | RECORD    | X             | GRANTED     | 1047, 20, 1, '1학기       '        |
|  57008 |       202 | file        | file_serial   | RECORD    | X,REC_NOT_GAP | GRANTED     | 1013, 20, 359, 2, '04            ' |
|  57008 |       202 | file        | file_serial   | RECORD    | X,REC_NOT_GAP | GRANTED     | 1046, 20, 359, 1, '1학기       '   |
|  57008 |       202 | file        | file_serial   | RECORD    | S,REC_NOT_GAP | GRANTED     | 359, 20, 1, 1, 'files         '    |
|  57008 |       202 | file        | PRIMARY       | RECORD    | X,GAP         | GRANTED     | 20, 359, 2, '10            '       |
|  57008 |       202 | file        | PRIMARY       | RECORD    | X,REC_NOT_GAP | GRANTED     | 20, 1047, 1, '1학기       '        |
|  57008 |       202 | file        | PRIMARY       | RECORD    | X,REC_NOT_GAP | GRANTED     | 20, 359, 1, '1학기       '         |
|  57008 |       202 | file        | PRIMARY       | RECORD    | X,REC_NOT_GAP | GRANTED     | 20, 359, 2, '04            '       |
|  57008 |       202 | file        | PRIMARY       | RECORD    | S,REC_NOT_GAP | GRANTED     | 20, 1, 1, 'files         '         |
+--------+-----------+-------------+---------------+-----------+---------------+-------------+------------------------------------+
```

## copy_origin 정리

복사의 마지막 단계에서 이루어지는 실제 파일 데이터의 복사는 copy_origin이 0이 아닌 파일을 대상으로 진행합니다. 즉 이미 이전 복사 명령으로 복사가 완료된 파일들의 경우 copy_origin이 0으로 바뀌어야 하므로 해당 작업이 진행됩니다.

이 작업이 진행된 직후 새로 파일 복사가 이루어졌다면 복사가 중복으로 되는 문제가 발생하므로 transaction에 포함됩니다.

원래 이 작업은 primary key로 탐색이 이루어졌습니다. range이므로 효율적일 것으로 생각할 수 있지만, primary key에 copy_origin이 없으며, user_serial=20인 조건만으로 탐색을 하는 경우 해당 사용자가 소유한 모든 파일을 스캔하게 되므로 매우 비효율적입니다.

또한 이렇게 진행하는 경우 탐색 대상인 레코드들, 즉 해당 사용자가 소유한 대부분 또는 모든 파일이 next key lock의 X로 잠기게 되어 복사 작업 도중 해당 사용자가 다른 작업을 할 수 없게 됩니다. 또한 다른 사용자와 공유한 파일의 정보를 접근할 때도 문제가 발생하게 됩니다.

이를 해결하기 위해 user_serial_2 (user_serial, copy_origin)을 인덱스로 추가했습니다. 그 결과 user_serial_2로 탐색을 진행하게 되었고 lock의 수와 실행 계획의 rows가 매우 줄어들었다는 것을 확인할 수 있습니다.

```
// clean copy_origin for operation
update file set copy_origin=0 where user_serial=20 and copy_origin<>0
+----+-------------+-------+------------+-------++---------+---------+-------+------+----------+-------------+
| id | select_type | table | partitions | type  || key     | key_len | ref   | rows | filtered | Extra       |
+----+-------------+-------+------------+-------++---------+---------+-------+------+----------+-------------+
|  1 | UPDATE      | file  | NULL       | range || PRIMARY | 4       | const |   52 |   100.00 | Using where |
+----+-------------+-------+------------+-------++---------+---------+-------+------+----------+-------------+
// after:key(user_serial, copy_origin),
+----+-------------+-------+------------+-------++---------------+---------+-------------+------+----------+------------------------------+
| id | select_type | table | partitions | type  || key           | key_len | ref         | rows | filtered | Extra                        |
+----+-------------+-------+------------+-------++---------------+---------+-------------+------+----------+------------------------------+
|  1 | UPDATE      | file  | NULL       | range || user_serial_2 | 12      | const,const |    2 |   100.00 | Using where; Using temporary |
+----+-------------+-------+------------+-------++---------------+---------+-------------+------+----------+------------------------------+
// after:
+--------+-----------+-------------+---------------+-----------+---------------+-------------+------------------------------------+
| trx_id | THREAD_ID | OBJECT_NAME | INDEX_NAME    | LOCK_TYPE | LOCK_MODE     | LOCK_STATUS | LOCK_DATA                          |
+--------+-----------+-------------+---------------+-----------+---------------+-------------+------------------------------------+
|  57027 |       202 | file        | NULL          | TABLE     | IS            | GRANTED     | NULL                               |
|  57027 |       202 | file        | NULL          | TABLE     | IX            | GRANTED     | NULL                               |
|  57027 |       202 | file        | user_serial_2 | RECORD    | X             | GRANTED     | supremum pseudo-record             |
|  57027 |       202 | file        | user_serial_2 | RECORD    | X             | GRANTED     | 20, 0, 1, 1, 'files         '      |
|  57027 |       202 | file        | parent_serial | RECORD    | X,GAP         | GRANTED     | 1048, 20, 2, '01            '      |
|  57027 |       202 | file        | parent_serial | RECORD    | X,GAP         | GRANTED     | 1047, 20, 1, '예비 폴더 '          |
|  57027 |       202 | file        | parent_serial | RECORD    | X             | GRANTED     | 1047, 20, 1, '1학기       '        |
|  57027 |       202 | file        | file_serial   | RECORD    | X,REC_NOT_GAP | GRANTED     | 1013, 20, 359, 2, '04            ' |
|  57027 |       202 | file        | file_serial   | RECORD    | X,REC_NOT_GAP | GRANTED     | 1046, 20, 359, 1, '1학기       '   |
|  57027 |       202 | file        | file_serial   | RECORD    | S,REC_NOT_GAP | GRANTED     | 359, 20, 1, 1, 'files         '    |
|  57027 |       202 | file        | PRIMARY       | RECORD    | X,GAP         | GRANTED     | 20, 359, 2, '10            '       |
|  57027 |       202 | file        | PRIMARY       | RECORD    | X,REC_NOT_GAP | GRANTED     | 20, 1, 1, 'files         '         |
|  57027 |       202 | file        | PRIMARY       | RECORD    | X,REC_NOT_GAP | GRANTED     | 20, 1047, 1, '1학기       '        |
|  57027 |       202 | file        | PRIMARY       | RECORD    | X,REC_NOT_GAP | GRANTED     | 20, 359, 1, '1학기       '         |
|  57027 |       202 | file        | PRIMARY       | RECORD    | X,REC_NOT_GAP | GRANTED     | 20, 359, 2, '04            '       |
|  57027 |       202 | file        | PRIMARY       | RECORD    | S,REC_NOT_GAP | GRANTED     | 20, 1, 1, 'files         '         |
+--------+-----------+-------------+---------------+-----------+---------------+-------------+------------------------------------+
// before: 66개의 잠금 존재
+--------+-----------+-------------+---------------+-----------+---------------+-------------+-------------------------+
| trx_id | THREAD_ID | OBJECT_NAME | INDEX_NAME    | LOCK_TYPE | LOCK_MODE     | LOCK_STATUS | LOCK_DATA               |
+--------+-----------+-------------+---------------+-----------+---------------+-------------+-------------------------+
|  57008 |       202 | file        | PRIMARY       | RECORD    | X             | GRANTED     | 20, 359, 2, '22 '       |
(생략)
|  57008 |       202 | file        | PRIMARY       | RECORD    | X             | GRANTED     | 20, 359, 2, '23 '       |
+--------+-----------+-------------+---------------+-----------+---------------+-------------+-------------------------+
```

## 덮어쓸 대상 파일 탐색

type='file'이 있으므로 자동으로 type='dir'인 경우를 배제하는 것을 확인할 수 있습니다.

모든 조건이 primary key로만 판단이 가능하며 range로 탐색하므로 효율적이라고 판단되며, primary key의 탐색이므로 인덱스에 소속되지 않은 last_renamed 값의 호출이 불필요한 탐색으로 이어지지 않을 것임을 알 수 있습니다.

```
// in the case of overwrites
select file_serial, last_renamed from file where user_serial=20 and parent_serial=1047 and type='file' and (type, file_name) in (('dir', '1학기'), ('file', '1')) for update
+----+-------------+-------+------------+-------++---------+---------+------+------+----------+-------------+
| id | select_type | table | partitions | type  || key     | key_len | ref  | rows | filtered | Extra       |
+----+-------------+-------+------------+-------++---------+---------+------+------+----------+-------------+
|  1 | SIMPLE      | file  | NULL       | range || PRIMARY | 173     | NULL |    1 |   100.00 | Using where |
+----+-------------+-------+------------+-------++---------+---------+------+------+----------+-------------+
-> Filter: (("file"."type" = 'file') and ("file".parent_serial = 1047) and ("file".user_serial = 20) and (("file"."type","file".file_name) in (('dir','1학기'),('file','1'))))  (cost=0.46 rows=1)
    -> Index range scan on file using PRIMARY over (user_serial = 20 AND parent_serial = 1047 AND type = 'file' AND file_name = '1')  (cost=0.46 rows=1)
+--------+-----------+-------------+---------------+-----------+---------------+-------------+------------------------------------+
| trx_id | THREAD_ID | OBJECT_NAME | INDEX_NAME    | LOCK_TYPE | LOCK_MODE     | LOCK_STATUS | LOCK_DATA                          |
+--------+-----------+-------------+---------------+-----------+---------------+-------------+------------------------------------+
|  57009 |       202 | file        | NULL          | TABLE     | IS            | GRANTED     | NULL                               |
|  57009 |       202 | file        | NULL          | TABLE     | IX            | GRANTED     | NULL                               |
|  57009 |       202 | file        | parent_serial | RECORD    | X,GAP         | GRANTED     | 1048, 20, 2, '01            '      |
|  57009 |       202 | file        | parent_serial | RECORD    | X,GAP         | GRANTED     | 1047, 20, 1, '예비 폴더 '          |
|  57009 |       202 | file        | parent_serial | RECORD    | X             | GRANTED     | 1047, 20, 1, '1학기       '        |
|  57009 |       202 | file        | file_serial   | RECORD    | X,REC_NOT_GAP | GRANTED     | 1013, 20, 359, 2, '04            ' |
|  57009 |       202 | file        | file_serial   | RECORD    | X,REC_NOT_GAP | GRANTED     | 1046, 20, 359, 1, '1학기       '   |
|  57009 |       202 | file        | file_serial   | RECORD    | S,REC_NOT_GAP | GRANTED     | 359, 20, 1, 1, 'files         '    |
|  57009 |       202 | file        | PRIMARY       | RECORD    | X,GAP         | GRANTED     | 20, 359, 2, '10            '       |
|  57009 |       202 | file        | PRIMARY       | RECORD    | X,GAP         | GRANTED     | 20, 1048, 2, '01            '      |
|  57009 |       202 | file        | PRIMARY       | RECORD    | X,REC_NOT_GAP | GRANTED     | 20, 1047, 1, '1학기       '        |
|  57009 |       202 | file        | PRIMARY       | RECORD    | X,REC_NOT_GAP | GRANTED     | 20, 359, 1, '1학기       '         |
|  57009 |       202 | file        | PRIMARY       | RECORD    | X,REC_NOT_GAP | GRANTED     | 20, 359, 2, '04            '       |
|  57009 |       202 | file        | PRIMARY       | RECORD    | S,REC_NOT_GAP | GRANTED     | 20, 1, 1, 'files         '         |
+--------+-----------+-------------+---------------+-----------+---------------+-------------+------------------------------------+

// if there is anything to delete, runs deleteFiles, which has its queries itself
```

## 이동/복사 진행

이전 쿼리들과 마찬가지로 file_serial에 range로 이루어지는 것을 확인할 수 있습니다.

파일별로 transaction을 분리할 수도 있으나 그 경우 각각의 파일별로 파일 이름 중복 등을 개별적으로 확인해야 하므로 비효율적일 것으로 판단하여 파일 이동/복사 작업 전체를 하나의 transaction으로 처리했습니다.

파일 레코드의 추가로 인해 잠금의 개수가 증가한 것을 확인할 수 있으며, 잠금 개수의 추가는 불가피하다고 판단됩니다.

```
// in the case of move
update file set parent_serial=1047, last_renamed=current_timestamp where user_serial=20 and file_serial in (1046, 1048)
+----+-------------+-------+------------+-------++-------------+---------+-------+------+----------+------------------------------+
| id | select_type | table | partitions | type  || key         | key_len | ref   | rows | filtered | Extra                        |
+----+-------------+-------+------------+-------++-------------+---------+-------+------+----------+------------------------------+
|  1 | UPDATE      | file  | NULL       | range || file_serial | 8       | const |    2 |   100.00 | Using where; Using temporary |
+----+-------------+-------+------------+-------++-------------+---------+-------+------+----------+------------------------------+

// in the case of copy
insert into file (user_serial, parent_serial, type, file_name, mark, copy_origin) select 20, 1047, type, file_name, 'true', file_serial from file where user_serial=20 and file_serial in (1046, 1048)
+----+-------------+-------+------------+-------++-------------+---------+------+------+----------+-------------------------------------------+
| id | select_type | table | partitions | type  || key         | key_len | ref  | rows | filtered | Extra                                     |
+----+-------------+-------+------------+-------++-------------+---------+------+------+----------+-------------------------------------------+
|  1 | INSERT      | file  | NULL       | ALL   || NULL        | NULL    | NULL | NULL |     NULL | NULL                                      |
|  1 | SIMPLE      | file  | NULL       | range || file_serial | 8       | NULL |    2 |    66.67 | Using where; Using index; Using temporary |
+----+-------------+-------+------------+-------++-------------+---------+------+------+----------+-------------------------------------------+
+--------+-----------+-------------+---------------+-----------+---------------+-------------+------------------------------------------+
| trx_id | THREAD_ID | OBJECT_NAME | INDEX_NAME    | LOCK_TYPE | LOCK_MODE     | LOCK_STATUS | LOCK_DATA                                |
+--------+-----------+-------------+---------------+-----------+---------------+-------------+------------------------------------------+
|  57027 |       202 | file        | file_serial   | RECORD    | S,REC_NOT_GAP | GRANTED     | 359, 20, 1, 1, 'files              '     |
|  57027 |       202 | file        | PRIMARY       | RECORD    | S,REC_NOT_GAP | GRANTED     | 20, 1047, 1, '예비 폴더      '           |
|  57027 |       202 | file        | PRIMARY       | RECORD    | S,REC_NOT_GAP | GRANTED     | 20, 1, 1, 'files              '          |
|  57027 |       202 | file        | PRIMARY       | RECORD    | X,REC_NOT_GAP | GRANTED     | 20, 359, 2, '04                 '        |
|  57027 |       202 | file        | PRIMARY       | RECORD    | X,REC_NOT_GAP | GRANTED     | 20, 359, 1, '1학기            '          |
|  57027 |       202 | file        | PRIMARY       | RECORD    | X,REC_NOT_GAP | GRANTED     | 20, 1047, 1, '1학기            '         |
|  57027 |       202 | file        | PRIMARY       | RECORD    | X,REC_NOT_GAP | GRANTED     | 20, 1, 1, 'files              '          |
|  57027 |       202 | file        | PRIMARY       | RECORD    | X,GAP         | GRANTED     | 20, 1048, 2, '01                 '       |
|  57027 |       202 | file        | PRIMARY       | RECORD    | X,GAP         | GRANTED     | 20, 359, 2, '10                 '        |
|  57027 |       202 | file        | PRIMARY       | RECORD    | X,GAP         | GRANTED     | 20, 1047, 2, '01                 '       |
|  57027 |       202 | file        | file_serial   | RECORD    | S,REC_NOT_GAP | GRANTED     | 1048, 20, 1047, 1, '예비 폴더      '     |
|  57027 |       202 | file        | file_serial   | RECORD    | S,REC_NOT_GAP | GRANTED     | 1047, 20, 359, 1, '2학년            '    |
|  57027 |       202 | file        | file_serial   | RECORD    | S,REC_NOT_GAP | GRANTED     | 1049, 20, 1048, 2, '01                 ' |
|  57027 |       202 | user        | NULL          | TABLE     | IS            | GRANTED     | NULL                                     |
|  57027 |       202 | file        | file_serial   | RECORD    | X,REC_NOT_GAP | GRANTED     | 1046, 20, 359, 1, '1학기            '    |
|  57027 |       202 | file        | file_serial   | RECORD    | X,REC_NOT_GAP | GRANTED     | 1013, 20, 359, 2, '04                 '  |
|  57027 |       202 | file        | parent_serial | RECORD    | X             | GRANTED     | 1047, 20, 1, '1학기            '         |
|  57027 |       202 | file        | parent_serial | RECORD    | X,GAP         | GRANTED     | 1047, 20, 2, '01                 '       |
|  57027 |       202 | file        | parent_serial | RECORD    | X,GAP         | GRANTED     | 1047, 20, 1, '예비 폴더      '           |
|  57027 |       202 | file        | parent_serial | RECORD    | X,GAP         | GRANTED     | 1048, 20, 2, '01                 '       |
|  57027 |       202 | file        | user_serial_2 | RECORD    | X             | GRANTED     | 20, 0, 1, 1, 'files              '       |
|  57027 |       202 | file        | user_serial_2 | RECORD    | X             | GRANTED     | supremum pseudo-record                   |
|  57027 |       202 | file        | user_serial_2 | RECORD    | X,GAP         | GRANTED     | 20, 1049, 1047, 2, '01                 ' |
|  57027 |       202 | user        | PRIMARY       | RECORD    | S,REC_NOT_GAP | GRANTED     | 20                                       |
|  57027 |       202 | file        | NULL          | TABLE     | IX            | GRANTED     | NULL                                     |
|  57027 |       202 | file        | NULL          | TABLE     | IS            | GRANTED     | NULL                                     |
+--------+-----------+-------------+---------------+-----------+---------------+-------------+------------------------------------------+
```

## recursive copy 등 나머지 작업

recursive copy (폴더를 복사했을 때 하위 파일들을 복사하는 작업) 쿼리는 본래 매우 비효율적이었던 것으로 판단됩니다. file이라는 모든 사용자의 모든 파일과 폴더를 가지고 있는 테이블을 ALL로 스캔하는 것은 매우 비효율적입니다.

그 근본적인 원인은 쿼리에 f2에 대한 조건이 부족했기 때문으로 판단되었고, copy_origin에 대한 작업이므로 user_serial_2 (user_serial, copy_origin)을 사용하는 방식으로 쿼리를 수정하였습니다. 복사 과정에서 user_serial을 원본 파일의 조건으로 두는 것은 복사 공유 작업에서 위험할 수 있다. 그러나 복사 공유 작업은 recycle로 처음 파일이 생성되는 구조이며, 그 결과 FilesService.shareCopy_createFile()을 통해 독자적으로 이루어지므로 문제가 발생하지 않습니다.

또한 MySQL 쿼리가 아니므로 직접적으로 등장하지는 않지만 copyMongo() 작업을 transaction 내부로 이동시켰습니다. 이는 물리적 파일의 복사가 실패할 경우 해당 파일의 file 테이블상의 레코드는 유효하지 않게 되기 때문으로 복사가 실패할 경우 rollback이 필요하기 때문입니다.

이때 레코드의 잠금 시간이 길어지는 것이 우려될 수 있습니다. 이동/복사 과정에서는 file 테이블의 레코드 중 작업 대상 파일 및 폴더에 대해 X lock이 발생하고, 사용자에 대해 S 레코드 잠금이 발생합니다.

1. 이중 X lock은 대체적으로 같은 폴더 내의 파일 중 복사/이동 대상, 그리고 목적지 폴더의 이름이 같은 레코드 대상으로 잡히게 됩니다. 즉 복사/이동 대상이 아닌 파일들은 문제가 없으므로 고려 대상이 아닙니다.

2. 복사/이동 대상 파일들에 대해 생각해 본다면, 복사의 경우 복사 대상 파일에 X 잠금이 발생하는 것은 비합리적입니다. 이에 따라 복사의 경우 for share로 앞의 쿼리들을 수정하였습니다. 그 결과 목적지 파일이 아닌 복사 대상 파일은 잠금이 S-lock임을 확인할 수 있습니다.

```
+--------+-----------+-------------+---------------+-----------+---------------+-------------+--------------------------------------------------------------+
| trx_id | THREAD_ID | OBJECT_NAME | INDEX_NAME    | LOCK_TYPE | LOCK_MODE     | LOCK_STATUS | LOCK_DATA                                                    |
+--------+-----------+-------------+---------------+-----------+---------------+-------------+--------------------------------------------------------------+
|  57050 |       202 | file        | file_serial   | RECORD    | S,REC_NOT_GAP | GRANTED     | 1013, 20, 359, 2, '04                                      ' |
|  57050 |       202 | file        | PRIMARY       | RECORD    | S,REC_NOT_GAP | GRANTED     | 20, 359, 2, '04                                      '       |
|  57050 |       202 | file        | PRIMARY       | RECORD    | S,REC_NOT_GAP | GRANTED     | 20, 359, 1, '1학기                                 '         |
|  57050 |       202 | file        | PRIMARY       | RECORD    | S,REC_NOT_GAP | GRANTED     | 20, 1, 1, 'files                                   '         |
|  57050 |       202 | file        | PRIMARY       | RECORD    | X,REC_NOT_GAP | GRANTED     | 20, 1047, 1, '1학기                                 '        |
|  57050 |       202 | file        | PRIMARY       | RECORD    | X,REC_NOT_GAP | GRANTED     | 20, 1, 1, 'files                                   '         |
|  57050 |       202 | file        | PRIMARY       | RECORD    | S,GAP         | GRANTED     | 20, 359, 2, '10                                      '       |
|  57050 |       202 | file        | PRIMARY       | RECORD    | X,GAP         | GRANTED     | 20, 1048, 2, '01                                      '      |
|  57050 |       202 | file        | file_serial   | RECORD    | S,REC_NOT_GAP | GRANTED     | 1046, 20, 359, 1, '1학기                                 '   |
|  57050 |       202 | file        | NULL          | TABLE     | IS            | GRANTED     | NULL                                                         |
|  57050 |       202 | file        | file_serial   | RECORD    | S,REC_NOT_GAP | GRANTED     | 359, 20, 1, 1, 'files                                   '    |
|  57050 |       202 | file        | parent_serial | RECORD    | X             | GRANTED     | 1047, 20, 1, '1학기                                 '        |
|  57050 |       202 | file        | parent_serial | RECORD    | X,GAP         | GRANTED     | 1047, 20, 1, '예비 폴더                           '          |
|  57050 |       202 | file        | parent_serial | RECORD    | X,GAP         | GRANTED     | 1048, 20, 2, '01                                      '      |
|  57050 |       202 | file        | user_serial_2 | RECORD    | X             | GRANTED     | 20, 0, 1, 1, 'files                                   '      |
|  57050 |       202 | file        | user_serial_2 | RECORD    | X             | GRANTED     | supremum pseudo-record                                       |
|  57050 |       202 | file        | NULL          | TABLE     | IX            | GRANTED     | NULL                                                         |
+--------+-----------+-------------+---------------+-----------+---------------+-------------+--------------------------------------------------------------+
```

3. 사용자에 대한 S 잠금은 사용자의 환경 설정 변경에 차질을 야기합니다. 그러나 해당 잠금은 file의 user_serial에 있는 foreign key constraint로 인해 부득이하게 발생하는 잠금으로, user 테이블을 설정/속성과 user_serial의 두 부분으로 분리하지 않는 이상 해결이 어려울 것으로 판단됩니다. 만약 환경 설정 변경이 자주 사용되는 기능이라면 copyMongo를 transaction 바깥으로 두고 실패한 파일들에 대해서는 따로 처리를 하는 것이 바람직할 수 있겠으나, 환경 설정의 변경 빈도는 높지 않을 것으로 예상됩니다. 그럼에도 환경 설정의 변경은 비밀번호 변경 등의 경우 locking이 되면 사용자의 입장에서 상당히 직관성이 떨어지고 큰 불편을 야기할 수 있는 것이 사실입니다. 따라서 이후에 user 테이블이 user_serial 정도를 담는, foreign key constraint를 위해 존재하는 테이블과 기존의 user 테이블의 정보를 담는 테이블로 분리하는 것이 필요하다고 판단됩니다.

```
// moveFiles_rename
select file_serial from file where user_serial=? and parent_serial=? and type=? and file_name=? for share

// moveFiles_rename - in the case of move
update file set file_name=?, parent_serial=? where file_serial=?

// moveFiles_rename - in the case of copy
insert into file (user_serial, parent_serial, type, file_name, last_modified, copy_origin) value (?)
select * from file where file_serial=? for share

// moveFiles_rename may be repeated
select file_serial from file where user_serial=? and parent_serial=? and type=? and file_name=? for share

// moveFiles_copyRecurse
select file_serial from file where user_serial=20 and type='dir' and copy_origin<>0 for share
+----+-------------+-------+------------+-------++---------------+---------+------+------+----------+-----------------------+
| id | select_type | table | partitions | type  || key           | key_len | ref  | rows | filtered | Extra                 |
+----+-------------+-------+------------+-------++---------------+---------+------+------+----------+-----------------------+
|  1 | SIMPLE      | file  | NULL       | range || user_serial_2 | 12      | NULL |    2 |    25.00 | Using index condition |
+----+-------------+-------+------------+-------++---------------+---------+------+------+----------+-----------------------+

// before: insert into file (user_serial, parent_serial, type, file_name, last_modified, copy_origin) select f1.user_serial, f2.file_serial, f1.type, f1.file_name, f1.last_modified, f1.file_serial from file as f1 inner join file as f2 on f1.parent_serial=f2.copy_origin where f1.user_serial=20 and f2.type='dir'
+----+-------------+-------+------------+------++---------+---------+-----------------------------------+------+----------+------------------------------+
| id | select_type | table | partitions | type || key     | key_len | ref                               | rows | filtered | Extra                        |
+----+-------------+-------+------------+------++---------+---------+-----------------------------------+------+----------+------------------------------+
|  1 | INSERT      | file  | NULL       | ALL  || NULL    | NULL    | NULL                              | NULL |     NULL | NULL                         |
|  1 | SIMPLE      | f2    | NULL       | ALL  || NULL    | NULL    | NULL                              |   79 |    25.00 | Using where; Using temporary |
|  1 | SIMPLE      | f1    | NULL       | ref  || PRIMARY | 12      | const,reminder_web.f2.copy_origin |    5 |   100.00 | NULL                         |
+----+-------------+-------+------------+------++---------+---------+-----------------------------------+------+----------+------------------------------+
// after: 
insert into file (user_serial, parent_serial, type, file_name, last_modified, copy_origin) select f1.user_serial, f2.file_serial, f1.type, f1.file_name, f1.last_modified, f1.file_serial from file as f1 inner join file as f2 on f1.parent_serial=f2.copy_origin where f2.user_serial=20 and f2.copy_origin<>0 and f2.type='dir' and f1.user_serial=20
+----+-------------+-------+------------+-------++---------------+---------+-----------------------------------+------+----------+----------------------------------------+
| id | select_type | table | partitions | type  || key           | key_len | ref                               | rows | filtered | Extra                                  |
+----+-------------+-------+------------+-------++---------------+---------+-----------------------------------+------+----------+----------------------------------------+
|  1 | INSERT      | file  | NULL       | ALL   || NULL          | NULL    | NULL                              | NULL |     NULL | NULL                                   |
|  1 | SIMPLE      | f2    | NULL       | range || user_serial_2 | 12      | NULL                              |    2 |    25.00 | Using index condition; Using temporary |
|  1 | SIMPLE      | f1    | NULL       | ref   || PRIMARY       | 12      | const,reminder_web.f2.copy_origin |    5 |   100.00 | NULL                                   |
+----+-------------+-------+------------+-------++---------------+---------+-----------------------------------+------+----------+----------------------------------------+

update file set copy_origin=0 where user_serial=20 and type='dir' and file_serial in (1052)
+----+-------------+-------+------------+-------------++---------------------+---------+------+------+----------+---------------------------------------------------+
| id | select_type | table | partitions | type        || key                 | key_len | ref  | rows | filtered | Extra                                             |
+----+-------------+-------+------------+-------------++---------------------+---------+------+------+----------+---------------------------------------------------+
|  1 | UPDATE      | file  | NULL       | index_merge || file_serial,PRIMARY | 8,4     | NULL |    1 |   100.00 | Using intersect(file_serial,PRIMARY); Using where |
+----+-------------+-------+------------+-------------++---------------------+---------+------+------+----------+---------------------------------------------------+
// file_serial in (1052, 1053)
+----+-------------+-------+------------+-------++-------------+---------+-------+------+----------+-------------+
| id | select_type | table | partitions | type  || key         | key_len | ref   | rows | filtered | Extra       |
+----+-------------+-------+------------+-------++-------------+---------+-------+------+----------+-------------+
|  1 | UPDATE      | file  | NULL       | range || file_serial | 8       | const |    2 |   100.00 | Using where |
+----+-------------+-------+------------+-------++-------------+---------+-------+------+----------+-------------+
// may be repeated

// clean up moveFiles_copyRecurse
update file set copy_origin=0 where user_serial=20 and type='dir' and copy_origin<>0
+----+-------------+-------+------------+-------++---------------+---------+-------------+------+----------+------------------------------+
| id | select_type | table | partitions | type  || key           | key_len | ref         | rows | filtered | Extra                        |
+----+-------------+-------+------------+-------++---------------+---------+-------------+------+----------+------------------------------+
|  1 | UPDATE      | file  | NULL       | range || user_serial_2 | 12      | const,const |    2 |   100.00 | Using where; Using temporary |
+----+-------------+-------+------------+-------++---------------+---------+-------------+------+----------+------------------------------+

// fetch copied file data
select file_serial, copy_origin from file where user_serial=20 and copy_origin<>0 for share
+----+-------------+-------+------------+-------++---------------+---------+------+------+----------+-----------------------+
| id | select_type | table | partitions | type  || key           | key_len | ref  | rows | filtered | Extra                 |
+----+-------------+-------+------------+-------++---------------+---------+------+------+----------+-----------------------+
|  1 | SIMPLE      | file  | NULL       | range || user_serial_2 | 12      | NULL |    2 |   100.00 | Using index condition |
+----+-------------+-------+------------+-------++---------------+---------+------+------+----------+-----------------------+

commit
```