# Upload의 MySQL 동작 관련 분석

## 증상

Files에서 업로드 기능을 통해 서로 다른 rmb파일 3개를 동시에 업로드하려 시도했을 때,

1. 요청에 응답이 반환되지 않음

2. MySQL에 deadlock이 발생

이 두 가지 상황을 확인할 수 있었다.

## 1. 요청에 응답이 반환되지 않음

upload 도중에 오류가 발생할 경우 
FilesController.postManage
```
await pipeline(req, bb);
while ((!closeReturned) || (!streamDone)){
    await new Promise(resolve=>setImmediate(resolve));
}
```
에서 pipeline() 호출 후 while을 진입하지 않는다는 것을 Step over 및 breakpoint 설정을 통해 확인할 수 있었다. 또한 
FilesController.postManage
```
bb.on('close', ()=>{
    closeReturned = true;
});
```
에서 closeReturned가 호출되지 않는다는 것 또한 breakpoint 설정을 통해 확인할 수 있었다. 따라서 stream 과정에서 멈춰 있다는 것을 알 수 있었다. 그러나 `FilesController.postManage`의 
```
} catch (err) {
    retVal.failed.push([0, info.filename]);
    fstream.destroy();
    return;
} finally {
    streamDone = true;
}
```
에서 `catch` 및 `finally` 부분까지는 호출되는 것을 알 수 있었다. 즉 fstream.destroy()가 의도하지 않은 방식으로 작동했다는 것을 알 수 있었다.

해당 코드에서는 FilesService.uploadMongo가 실행되기 이전에, 또는 uploadMongo 실행 도중에 오류가 발생할 경우 stream에 대해 destroy()를 호출했었다. 그러나 [busboy의 안내서](https://github.com/mscdex/busboy?tab=readme-ov-file#special-parser-stream-events)에는 
```
Note: If you listen for this event, you should always consume the stream whether you care about its contents or not (you can simply do stream.resume(); if you want to discard/skip the contents), otherwise the 'finish'/'close' event will never fire on the busboy parser stream.
```
이를 통해 destroy를 호출하지 않고 resume을 호출해야만 한다는 것을 알 수 있었다. 이에 따라 busboy를 다루는 두 곳인 `FilesController.postManage`, `FilesService.uploadMongo` 에서 모든 `destroy()`를 `resume()`으로 변경하였다.

## 2. MySQL에 deadlock이 발생

[General Log: mysql-log.txt](mysql-log.txt) (관련 부분만 넣었으며 Prepare를 제거하고 주석을 추가하는 등의 변형이 있음)

[관련 explain: mysql_explain.txt](mysql_explain.txt)

mysql-log.txt
```
2026-01-04T11:27:24.816130Z	   11 Query	start transaction
2026-01-04T11:27:24.816464Z	   10 Query	start transaction
2026-01-04T11:27:24.817020Z	   11 Execute	select file_serial from file where user_serial=20 and parent_serial=360 for update
2026-01-04T11:27:24.817893Z	   11 Execute	delete from file where user_serial=20 and parent_serial=360
2026-01-04T11:27:24.818115Z	   10 Execute	select file_serial from file where user_serial=20 and parent_serial=360 for update
// this could not proceed. as a result, two 10s are sent consequently.
2026-01-04T11:27:24.818214Z	   11 Execute	insert into file (user_serial, parent_serial, type, file_name) value (20, 360, 'file', 'abc - Copy')
2026-01-04T11:27:24.818453Z	   10 Execute	delete from file where user_serial=20 and parent_serial=360
2026-01-04T11:27:24.818793Z	   10 Execute	insert into file (user_serial, parent_serial, type, file_name) value (20, 360, 'file', 'abc')
2026-01-04T11:27:24.819745Z	   10 Query	rollback // remember. it is deadlock. 11 couln't have proceeded without this rollback either.
2026-01-04T11:27:24.825536Z	   11 Execute	select file_serial, last_renamed from file where user_serial=20 and parent_serial=360
2026-01-04T11:27:24.826313Z	   11 Query	commit
```

1. deadlock이 발생한 시점은 MysqlService.doTransaction으로부터 rollback이 호출되기 직전, 즉 10이 insert into를 하던 때에 발생했다.
2. deadlock의 원인은 서로 같은 곳을 수정하는 두 transaction이 circular wait에 이르렀기 때문일 가능성이 높다.
    1. 서로 같은 형태의 transaction이 upload에서 동시에 호출되지 않도록 할 필요가 있다.
    2. 한 upload에서 동시에 transaction이 일어나지 않더라도 서로 다른 upload들이 겹칠 수 있다 (여러 폴더에서 upload 요청, 한 계정으로 여러 명이 서로 다른 곳에서 동시에 upload 등)
        따라서, transaction에서 구체적 상황의 분석 후 가능하면 방지할 수 있도록 하는 것이 필요하다.

### 1. 같은 형태의 transaction이 upload에서 동시에 호출되지 않도록 한다.

files.controller.ts postManage()
```
let streamDone = true;

const bb = busboy({headers: req.headers, fileHwm: 512, limits: {files: 100}, defParamCharset: 'utf8'});

bb.on('file', async (name: string, fstream: Readable, info: busboy.FileInfo)=>{
    let res: RowDataPacket[] = [];
    try{
        while (!streamDone) {
            await new Promise(resolve=>setImmediate(resolve));
        }
        streamDone = false;
        // ...
    } catch (err) {
        // ...
    } finally {
        streamDone = true;
    }
// ...
```
이처럼 `while`을 추가하여 하나의 POST 요청에서는 한 번에 한 개씩의 transaction만 실행되도록 수정하였다.

### 2. 구체적 상황의 분석 및 deadlock의 방지

#### 구체적 상황의 분석

mysql-log.txt
```
// this could not proceed. as a result, two 10s are sent consequently.
2026-01-04T11:27:24.818214Z	   11 Execute	insert into file (user_serial, parent_serial, type, file_name) value (20, 360, 'file', 'abc - Copy')
2026-01-04T11:27:24.818453Z	   10 Execute	delete from file where user_serial=20 and parent_serial=360
2026-01-04T11:27:24.818793Z	   10 Execute	insert into file (user_serial, parent_serial, type, file_name) value (20, 360, 'file', 'abc')
2026-01-04T11:27:24.819745Z	   10 Query	rollback // remember. it is deadlock. 11 couln't have proceeded without this rollback either.
```
rollback 직전에 실행이 시도된 작업들을 살펴 보면,
10의 경우, `10 Execute insert into file...` 
11의 경우, `11 Execute insert into file...`
10에서 `10 Execute delete ...` 이후 11이 아닌 10이 다시 호출되었다. 즉 11이 이미 lock을 대기 중이었기 때문임을 확인할 수 있다.

각 transaction이 대기 중이었던 lock을 확인해 보자.
insert 직전에 실행되는 `delete ...` 작업이 끝난 이후 hold하는 lock들을 살펴 보면,

mysql_explain.txt
```
+--------+-----------+---------------+-------------+------------+-----------+-----------+-------------+------------------------+
| trx_id | THREAD_ID | OBJECT_SCHEMA | OBJECT_NAME | INDEX_NAME | LOCK_TYPE | LOCK_MODE | LOCK_STATUS | LOCK_DATA              |
+--------+-----------+---------------+-------------+------------+-----------+-----------+-------------+------------------------+
|  55325 |        48 | reminder_web  | file        | NULL       | TABLE     | IX        | GRANTED     | NULL                   |
|  55325 |        48 | reminder_web  | file        | PRIMARY    | RECORD    | X         | GRANTED     | supremum pseudo-record |
+--------+-----------+---------------+-------------+------------+-----------+-----------+-------------+------------------------+
```
`supremum pseudo-record`는 Gap을 잠근다. Gap lock은:
[17.7.1 InnoDB Locking](https://dev.mysql.com/doc/refman/8.4/en/innodb-locking.html)
```
Gap locks in InnoDB are “purely inhibitive”, which means that their only purpose is to prevent other transactions from inserting to the gap. Gap locks can co-exist. 
```

따라서, 두 개의 transaction이 select와 delete 동안 Gap lock을 같이 hold하고 있었으며, 둘 다 insert를 해야 하는 상황이 되자 co-exist는 할 수 있지만 insert는 서로 방지하는 Gap lock으로 인해 insert할 수 없는 상황에 놓인 것으로 추정된다.

재발 가능성: 서로 다른 두 곳에서 각각 여러 파일을 게시할 경우 문제의 발생 가능성이 적지 않다.

기타 위험성: 현재 upload_tmp (360번 폴더) 폴더에 파일이 존재하지 않았던 관계로 lock에 `supreum pseudo-record`만 있었지만, upload_tmp에 파일이 존재하는 경우 `select...for update`에서 대기가 발생할 수 있고, 이 경우에도 gap lock을 가지게 되기 때문에 deadlock이 발생한다. 다만 upload_tmp에는 일반적인 경우 파일이 존재하지 않는다.

여기서부터는 "`while`을 추가하여 하나의 POST 요청에서는 한 번에 한 개씩의 transaction만 실행되도록 수정하였다." 적용 이후에 확인한 내용이지만 서로 다른 탭/창에서 동시에 파일을 업로드하는 상황과 유사한 상황을 구현하기 위해 일시적으로 `while` 변경 사항을 해제하고 진행하였다.

#### upload_tmp에 파일이 존재하는 경우에 대한 테스트

```mysql
insert into file (user_serial, parent_serial, type, file_name) value (20, 360, 'file', '시범');
start transaction;
select file_serial from file where user_serial=20 and parent_serial=360 for update;
delete from file where user_serial=20 and parent_serial=360;
select  ENGINE_TRANSACTION_ID,  THREAD_ID,  OBJECT_SCHEMA,  OBJECT_NAME,  INDEX_NAME,  LOCK_TYPE,  LOCK_MODE,  LOCK_STATUS,  LOCK_DATA
from performance_schema.data_locks order by ENGINE_TRANSACTION_ID;
commit;
```
lock 상태:
```
+-----------------------+-----------+---------------+--------------------+---------------+-----------+-----------+-------------+--------------------------------------------------------+
| ENGINE_TRANSACTION_ID | THREAD_ID | OBJECT_SCHEMA | OBJECT_NAME        | INDEX_NAME    | LOCK_TYPE | LOCK_MODE | LOCK_STATUS | LOCK_DATA                                              |
+-----------------------+-----------+---------------+--------------------+---------------+-----------+-----------+-------------+--------------------------------------------------------+
|                 55332 |        48 | reminder_web  | file               | NULL          | TABLE     | IX        | GRANTED     | NULL                                                   |
|                 55332 |        48 | reminder_web  | shared_def         | NULL          | TABLE     | IS        | GRANTED     | NULL                                                   |
|                 55332 |        48 | reminder_web  | shared_def         | file_serial_2 | RECORD    | S         | GRANTED     | supremum pseudo-record                                 |
|                 55332 |        48 | reminder_web  | file               | parent_serial | RECORD    | S         | GRANTED     | supremum pseudo-record                                 |
|                 55332 |        48 | reminder_web  | file               | PRIMARY       | RECORD    | X         | GRANTED     | supremum pseudo-record                                 |
|                 55332 |        48 | reminder_web  | file               | PRIMARY       | RECORD    | X         | GRANTED     | 20, 360, 2, '시범                                  '   |
|                 55333 |        29 | mysql         | innodb_table_stats | PRIMARY       | RECORD    | X         | GRANTED     | 'reminder_web', 'file'                                 |
+-----------------------+-----------+---------------+--------------------+---------------+-----------+-----------+-------------+--------------------------------------------------------+
```
한 쪽에서 select, delete까지 한 이후 다른 쪽에서 select를 했을 때의 상태: 
lock으로 인해 두 번째로 select한 곳이 대기 상태였으며, 당시의 lock 상태는 다음과 같다.
```
+--------+-----------+---------------+-------------+---------------+-----------+-----------+-------------+--------------------------------------------------------+
| trx_id | THREAD_ID | OBJECT_SCHEMA | OBJECT_NAME | INDEX_NAME    | LOCK_TYPE | LOCK_MODE | LOCK_STATUS | LOCK_DATA                                              |
+--------+-----------+---------------+-------------+---------------+-----------+-----------+-------------+--------------------------------------------------------+
|  55363 |        48 | reminder_web  | file        | NULL          | TABLE     | IX        | GRANTED     | NULL                                                   |
|  55363 |        48 | reminder_web  | shared_def  | NULL          | TABLE     | IS        | GRANTED     | NULL                                                   |
|  55363 |        48 | reminder_web  | shared_def  | file_serial_2 | RECORD    | S         | GRANTED     | supremum pseudo-record                                 |
|  55363 |        48 | reminder_web  | file        | parent_serial | RECORD    | S         | GRANTED     | supremum pseudo-record                                 |
|  55363 |        48 | reminder_web  | file        | PRIMARY       | RECORD    | X         | GRANTED     | supremum pseudo-record                                 |
|  55363 |        48 | reminder_web  | file        | PRIMARY       | RECORD    | X         | GRANTED     | 20, 360, 2, '시범                                  '   |
|  55364 |        55 | reminder_web  | file        | NULL          | TABLE     | IX        | GRANTED     | NULL                                                   |
|  55364 |        55 | reminder_web  | file        | PRIMARY       | RECORD    | X         | WAITING     | 20, 360, 2, '시범                                  '   |
+--------+-----------+---------------+-------------+---------------+-----------+-----------+-------------+--------------------------------------------------------+
```
이때 원래 select한 곳에서 insert를 하면 deadlock이 발생하는 것을 확인할 수 있다.

#### deadlock의 방지

따라서, deadlock으로 인한 오류는 위의 `while`을 통한 파일 업로드 동시 작업 방지가 이루어져도, upload_tmp에 속한 레코드가 있었어도, 없었어도 발생할 수 있다. 이에 대한 대응 방안으로는 쿼리 내용의 수정, 그리고 deadlock이 발생했을 때의 재시도가 있다.

select를 통해 가지게 되는 circular wait을 해결할 방법, 즉 이 경우 lock을 가지고 있는 때에 상대방이 lock을 요청하는 상황 자체를 방지하기에는 어렵다고 판단하여 오류가 발생한 경우 일정한 시간동안 정지한 다음 재시도하는 방식으로 코드를 구성하였다.

FilesController.postManage
```
let retry = true, times = 0;
let filename = info.filename.length > 4 ? info.filename.slice(0, -4) : info.filename;
while (retry){
    try {
        retry = false;
        [res] = await conn.execute<RowDataPacket[]>(
            `select file_serial from file where user_serial=? and parent_serial=? for update`, [userSer, dir]
        );
        for (const itm of res){
            try{
                await fs.rm(join(__dirname, `../../filesys/${itm.file_serial}`), {force: true, recursive: true});
            } catch (err) {}
        }
        await conn.execute(`delete from file where user_serial=? and parent_serial=?`, [userSer, dir]);
        await conn.execute(`insert into file ${subt} value (?, ?, 'file', ?)`,
            [userSer, dir, filename]
        );
    } catch (err) {
        times++;
        if (times < 4){
            retry = true;
            await new Promise(resolve=>setTimeout(resolve, 1000));
        } else {
            throw err;
        }
    }
}
```

이를 통해 일부 deadlock에 대해 오류를 방지할 수 있었다.

#### 알 수 없는 현상

다만 해당 코드를 구현하자 알 수 없는 상황이 발생했다. 세 개의 파일을 업로드한 경우 첫 번째 파일은 정상적으로 처리되었지만 두 번째 파일과 세 번째 파일의 경우 해당 `while (retry) {...}` 직후에 실행되는 
```
[res] = await conn.execute<RowDataPacket[]>(
    `select file_serial, last_renamed from file where user_serial=? and parent_serial=? and type='file' and file_name=? for share`,
    [userSer, dir, filename]
);
```
에서 문제가 발생한 것이다.

원래 이 과정에서 한 transaction에서 실행되는 쿼리는 예를 들어
```
start transaction
select file_serial from file where user_serial=20 and parent_serial=360 for update
delete from file where user_serial=20 and parent_serial=360
insert into file (user_serial, parent_serial, type, file_name) value (20, 360, 'file', 'abc - Copy')
select file_serial, last_renamed from file where user_serial=20 and parent_serial=360 for share
commit
```
다음과 같다. 즉 특정 폴더에 기존에 있던 모든 파일 레코드를 삭제한 후에 새로 파일 레코드를 하나 추가한 후, 다시 해당 폴더의 파일 레코드를 검색하는 구조이다. for update를 사용하는 하나의 쿼리이므로 일반적으로 마지막 select를 실행하면 하나의 결과만이 반환되어야 한다. 
그러나 실제로는 2, 3째 파일에 대한 transaction의 경우 코드에서 원래 실행되어야 하는 하나의 결과가 아닌 두 개의 결과씩을 반환했다. 그리고 두 transaction이 반환한 결과는 동일했다. 즉 서로 상대방이 insert한 레코드를 commit 이전에 읽은 것과 같은 결과가 나온 것이다.

이를 방지하기 위해서 우선적으로는 파일명까지 확인하도록 마지막 select 쿼리에 file_name까지의 확인을 추가하였다. 같은 upload_tmp 폴더 내에서 같은 type='file'인 경우 file_name이 같을 수는 없기 때문이다. (user_serial, parent_serial, type, file_name)으로 구성된 PRIMARY index를 활용하기 위하여 type='file'까지 추가하였다.
이후 해당 쿼리를 다시 실행하고 실행한 쿼리의 General Log를 확인하였다. 그 결과는 아래와 같았다.

General Log
(해당 파일 없음) (Prepare, `while` 재시도 이전에 호출된 사항은 제거하였다)
```
2026-01-05T15:25:03.373928Z        82 Query     start transaction
2026-01-05T15:25:08.543555Z        82 Execute   select file_serial from file where user_serial=20 and parent_serial=360 for update
2026-01-05T15:25:08.547116Z        84 Query     start transaction
2026-01-05T15:25:09.043577Z        83 Query     start transaction
2026-01-05T15:25:09.044441Z        84 (거절)    select file_serial from file where user_serial=20 and parent_serial=360 for update
2026-01-05T15:25:09.611476Z        82 Execute   delete from file where user_serial=20 and parent_serial=360
2026-01-05T15:25:09.611799Z        83 (거절)    select file_serial from file where user_serial=20 and parent_serial=360 for update
2026-01-05T15:25:09.612903Z        82 Execute   insert into file (user_serial, parent_serial, type, file_name) value (20, 360, 'file', 'abc - Copy')
2026-01-05T15:25:11.392832Z        83 Execute   select file_serial from file where user_serial=20 and parent_serial=360 for update
2026-01-05T15:25:12.407141Z        84 Execute   select file_serial from file where user_serial=20 and parent_serial=360 for update
2026-01-05T15:25:12.407536Z        82 Execute   select file_serial, last_renamed from file where user_serial=20 and parent_serial=360 and type='file' and file_name='abc - Copy' for share
2026-01-05T15:25:12.408566Z        82 Query     commit
2026-01-05T15:25:12.416480Z        83 Execute   delete from file where user_serial=20 and parent_serial=360
2026-01-05T15:25:12.416614Z        84 Execute   delete from file where user_serial=20 and parent_serial=360
2026-01-05T15:25:12.420255Z        83 Execute   insert into file (user_serial, parent_serial, type, file_name) value (20, 360, 'file', '웹')
2026-01-05T15:25:12.420726Z        84 Execute   insert into file (user_serial, parent_serial, type, file_name) value (20, 360, 'file', 'abc')
2026-01-05T15:25:12.425530Z        84 Execute   select file_serial, last_renamed from file where user_serial=20 and parent_serial=360 and type='file' and file_name='abc' for share
2026-01-05T15:25:12.425630Z        83 Execute   select file_serial, last_renamed from file where user_serial=20 and parent_serial=360 and type='file' and file_name='웹' for share
2026-01-05T15:25:12.427759Z        84 Query     commit
2026-01-05T15:25:12.427972Z        83 Query     commit
```

앞에서는 서로 다른 select는 각각 lock을 가지게 되었고, 이 lock들로 인해 두 transaction의 insert를 실행하려는 과정에서 deadlock이 발생했던 것을 기억할 것이다. 위의 log에서도 첫 번째로 실행된 82에 막혀 83, 84는 처음에 deadlock으로 인해 실행이 거부되었다. General Log에서는 실행 순서가 아닌 호출을 받은 순서대로 나열되기 때문에 실행되지 않은 query를 표시할 경우 혼동의 여지가 있다고 판단하였다. 따라서 위의 Log에서는 거부된 해당 실행들은 (거절)로 표기하였다.

이 Log는 `while (retry)` 코드가 추가된 이후 실행되었기 때문에 (다만 당시에는 1000ms 대기 없이 바로 재시도가 이루어졌다) 83, 84는 실행이 거부된 이후 rollback이 발생하지 않는 대신 lock이 풀릴 때까지 재시도 후 실행되었다. 문제는 83, 84 모두 select ... for update를 진행하며 실행되었음에도 서로에 대한 lock이 없이 거의 완전히 동시에 진행되었다는 것이다. 이를 통해 재시도 동작 이후에 실행된 select...for upadte 구문이 예상과는 다른 방식의 lock을 받았음을 추정할 수 있었다.

그러나 해당 log와 같은 순서로 쿼리를 직접 실행했을 때 실제로는 log 상으로 거절로 추정된 쿼리들이 막힘 없이 실행되었다. 따라서 해당 현상이 어떤 이유로 발생했는지 확인하기 어려웠다.

(참고: `while (retry)` 코드가 추가된 이후에야 실패한 transaction의 재시도가 발생하며 이 현상이 발견되었다. 이전에는 서로 다른 두 파일이 서로를 읽기 이전에 하나의 deadlock이 발생하면 transaction이 MysqlService.doTransaction의 코드에 따라 rollback 처리되었기 때문에 '재시도'를 통한 서로 다른 두 transaction의 동시 진행이 발생하지 않았다.)

결론적으로 쿼리에서 file_name까지 확인하는 방식으로 현재로서는 문제를 방지하였지만 해당 현상에 대해서는 근본적인 원인을 알 수 없었다. MySQL에서의 Lock 및 Isolation Level에 대해 간과하고 있는 점이 있어서일 것으로 추정되지만 아직 원인을 찾을 수 없었다.

다만 이외의 내용, 즉 deadlock이 발생하는 상황 및 오류가 발생할 때 응답이 전송되지 않는 상황에 대해서는 문제가 해결되었다.