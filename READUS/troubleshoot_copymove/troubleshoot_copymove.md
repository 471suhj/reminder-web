# 복사 및 이동 작업의 코드 가독성 개선, 최적화 및 오류 수정

## 문제 상황

### 1. 코드 가독성 및 유지 관리의 어려움

(기존 FilesService.moveFiles_rename의 일부)
```
str1 = `select file_serial from file `
str1 += `where user_serial=? and parent_serial=? and type in ('movedir', 'movefile') and char_length(file_name) > ? `;
str1 += 'for update';
// 5, 6: move only
let str5 = `select * from file where user_serial=? and file_serial in (?) `;
let str2 = `delete from file where user_serial=? and file_serial in (?) `;
let str6 = `insert into file values (?) `;
let str3 = `update file set file_name=concat(file_name, '-2') `
str3 += `where user_serial=? and parent_serial=? and (type='movedir' or type='movefile') order by file_name desc `;
const subq = `select file_name from file where user_serial=? and parent_serial=? and type in ('file', 'dir') for update `;
let str4 = `update file set type=if(type='movedir','dir','file'), last_renamed=current_timestamp where (type='movedir' or type='movefile') and file_name not in (?) `;
let str7 = `select file_serial from file where user_serial=? and (type='movedir' or type='movefile') for update `;
let result: RowDataPacket[];
let arrFail: [number, Date][] = [];
let cnt = 0;
while(true){
    // select files with names too long
    [result] = await conn.execute<RowDataPacket[]>(str1, [userSer, to, 40-2]);
    // fetch info about those files
    let result2: RowDataPacket[] = [];
```

파일 복사/이동 기능은 이후 작성되었고 임시 테이블 등을 사용하는 FilesService.shareCopy_createFile (사본 공유 기능)과 달리, MySQL 내에서 쿼리 작업 위주로 이루어지도록 작성되었습니다. 또한 범용적인 기능이었기 때문에 테이블의 constraint에 부합해야 하고 다양한 상황에 대비해야 했습니다.

그 결과 쿼리의 수가 매우 많은 작업이 되었고, 여러 개의 함수로 분리했음에도 controller의 코드와 FilesService.moveFiles_rename의 코드가 복잡하여 유지 관리가 어려웠습니다.

### 2. 생성된 사본의 파일 번호 확인 과정에서의 오류 발생

특히 복사 기능에서 복사 원본의 파일 번호와 새로 작성된 사본의 파일 번호를 제대로 불러올 수 없는 오류 상황이 발생했습니다.

## 해결 및 개선

### 1. FilesController.putMove() 코드 가독성 개선

1. 빈 줄을 추가하여 작업 단위별로 코드 분리

2. 변수 이름을 의미 파악이 쉽도록 수정

    resDup, arrDup, result, resName, arrSafe를 arrDuplicate (duplicate의 정보를 담은 배열), duplicateSerials (duplicate의 정보 중 file_serial만 담은 배열), resToDelete (쿼리의 result 중 삭제 대상 파일을 담은 result), arrTypeName ((type, file_name) 쌍으로 구성된 배열), arrValidFiles (존재하고 접근이 가능한지 확인된 파일 배열)로 수정

    또한 result와 같은 변수가 여러 쿼리의 결과를 담게 되며 위치에 따라 다른 의미를 가지게 되는 상황을 축소

    FilesService.moveFiles_validateFiles()의 목적인 파일의 접근성 검증 및 파일 이름 추출 중 파일 이름 추출이 코드의 구조 파악에 도움을 준다고 판단하여 moveFiles_getName()으로 변경

    (참고: 구체적으로는 파일의 이름을 얻는 작업에서는 파일에 대한 접근이 필요하므로 파일의 접근 권한 인증까지 부수적으로 진행할 수 있다고 생각할 수 있다고 생각합니다. 반면 파일의 접근 권한을 검증하는 과정에서 파일명을 추출하는 작업을 한다는 것은 직관적으로 예측하기 비교적 어렵다고 생각하며, 또한 '이름 추출'은 '중복 파일 확인' 등 이후 절차에 직접적으로 관련이 있는 작업이므로 getName으로 이름을 변경하는 것이 적절하다고 판단했습니다.)

3. block을 이용해서 코드의 일부분에서만 사용되는 변수 정리, 불필요한 destructuring으로 인한 복잡한 변수 구성을 destructuring 대신 일반 object로 반환받아 해결

이전:
```
let {retArr: arrSafe, arrFail, resName} = await this.filesService.moveFiles_validateFiles(conn, userSer, body.from, body.files.map(val=>[val.id, val.timestamp]));            

let resDup: RowDataPacket[];
if (resName.length > 0){
    // get the list of files with the same name in the destination
    [resDup] = await conn.query<RowDataPacket[]>(
        {sql: `select type, file_name from file where user_serial=? and parent_serial=? and (type, file_name) in (?) for update`, rowsAsArray: true},
        [userSer, body.to, resName]
    );
} else {
    resDup = [];
}
if (resDup.length > 0){
    [resDup] = await conn.query<RowDataPacket[]>(
        `select file_serial, type, file_name, last_renamed as timestamp from file where user_serial=? and parent_serial=? and (type, file_name) in (?) for update`,
        [userSer, body.from, resDup]
    );
} else {
    resDup = [];
}
```

이후:
```
// check the validity of files and get the (type,name)s.
const getNameRes = await this.filesService.moveFiles_getName(conn, userSer, body.from, body.files.map(val=>[val.id, val.timestamp]), body.action === 'move');            
let arrFail = getNameRes.arrFail;
const arrTypeName = getNameRes.arrTypeName;
const arrValidFiles = getNameRes.arrValidFiles;

// check for name duplicates. arrDuplicate is later updated to hold only non-overwritable items
let arrDuplicate: {file_serial: number, type: 'file'|'dir', file_name: string, timestamp: Date, modif: Date}[];
{
    const [resDuplicateNames] = (arrTypeName.length > 0) ? await conn.query<RowDataPacket[]>(
            {sql: `select type, file_name from file where user_serial=? and parent_serial=? and (type, file_name) in (?) for update`, rowsAsArray: true},
            [userSer, body.to, arrTypeName]
        ) : [[]];
    const [resDupPacket] = (resDuplicateNames.length > 0) ? await conn.query<RowDataPacket[]>(
            `select file_serial, type, file_name, last_renamed as timestamp, last_modified as modif from file where user_serial=? and parent_serial=? and (type, file_name) in (?) ` + body.action === 'move' ? 'for update' : 'for share',
            [userSer, body.from, resDuplicateNames]
        ) : [[]];
    arrDuplicate = resDupPacket as typeof arrDuplicate;
}
```

### 2. FilesService.moveFiles_rename() 코드 재작성

기존에는 파일을 이동 대상 폴더 소속으로 이동/삽입하되 (type, file_name)의 중복이 허용되지 않으므로 type을 movedir, movefile로 설정했습니다. 이후에 해당 테이블 내에서 중복된 (type, file_name)이 존재하지 않는 경우 type을 dir, file로 다시 변경하고, 중복되는 파일 이름이 있는 파일들의 이름에 한 번에 '-2'씩을 붙여 가며 파일명 중복 처리를 진행했습니다.

그러나 해당 방식은 매우 긴 분량의 코드와 매우 많은 양의 코드를 필요로 하며, MySQL과의 상호 작용이 매우 많은 편이었기 때문에 코드의 동작 방식 파악, 디버깅, 로직 수정이 매우 어려운 편이었습니다.

이에 따라 쿼리의 방식이 여러 파일의 병렬성이 떨어지더라도 가독성이 좋을 필요가 매우 크다는 판단을 통해 해당 함수의 코드를 완전히 재작성했습니다.

새로운 코드는 각 파일 하나하나에 대해 '이름이 겹치는가?-겹치면 이름을 바꾸고 다시 시도'만을 반복하는 비교적 매우 단순한 코드입니다. 이동 대상인 파일이 많을 경우 각 파일에 대해 쿼리를 실행하므로 많은 시간이 걸릴 수 있으나 기존의 코드에 비해 유지 관리가 매우 쉬운 편이므로 이 코드로의 변경이 적절하다고 판단했습니다.

아래는 기존 코드입니다.
```
let arr = new Map(arr_.map<[number, [string, string, Date]]>(val=>[val.file_serial, [val.type, val.file_name, val.timestamp]]));
let arrDirName = new Map<string, [number, Date]>();
let arrFileName = new Map<string, [number, Date]>();
arr_.forEach(val=>((val.type==='dir') ? arrDirName.set(val.file_name, [val.file_serial, val.timestamp]) : arrFileName.set(val.file_name, [val.file_serial, val.timestamp])));
let str1 = '';
// create entries. inserted entries can now be identified with types.
if (del) { // move
    str1 = `update file set type=if(type='dir','movedir','movefile'), parent_serial=?, last_renamed=current_timestamp `;
    str1 += `where user_serial=? and parent_serial=? and file_serial in (?) `;
    await conn.query<RowDataPacket[]>(str1, [to, userSer, from, Array.from(arr.keys())]);
} else { // copy
    str1 = `insert into file (user_serial, parent_serial, type, file_name, last_modified, copy_origin) `;
    str1 += `select ?, ?, if(type='dir','movedir','movefile'), file_name, last_modified, file_serial from file `;
    str1 += `where user_serial=? and parent_serial=? and file_serial in (?) `;
    await conn.query<RowDataPacket[]>(str1, [userSer, to, userSer, from, Array.from(arr.keys())]);
}
// don't forget to update last_renamed\
// also revert the types
// restore failed items to original
str1 = `select file_serial from file `
str1 += `where user_serial=? and parent_serial=? and type in ('movedir', 'movefile') and char_length(file_name) > ? `;
str1 += 'for update';
// 5, 6: move only
let str5 = `select * from file where user_serial=? and file_serial in (?) `;
let str2 = `delete from file where user_serial=? and file_serial in (?) `;
let str6 = `insert into file values (?) `;
let str3 = `update file set file_name=concat(file_name, '-2') `
str3 += `where user_serial=? and parent_serial=? and (type='movedir' or type='movefile') order by file_name desc `;
const subq = `select file_name from file where user_serial=? and parent_serial=? and type in ('file', 'dir') for update `;
let str4 = `update file set type=if(type='movedir','dir','file'), last_renamed=current_timestamp where (type='movedir' or type='movefile') and file_name not in (?) `;
let str7 = `select file_serial from file where user_serial=? and (type='movedir' or type='movefile') for update `;
let result: RowDataPacket[];
let arrFail: [number, Date][] = [];
let cnt = 0;
while(true){
    // select files with names too long
    [result] = await conn.execute<RowDataPacket[]>(str1, [userSer, to, 40-2]);
    // fetch info about those files
    let result2: RowDataPacket[] = [];
    if (result.length > 0){
        [result2] = await conn.query<RowDataPacket[]>(
            {sql: str5, rowsAsArray: true}, [userSer, result.map(val=>val.file_serial)]);
            // delete the files
        await conn.query(str2, [userSer, result.map(val=>val.file_serial)]);
        for (let i = 0; i < result2.length; i++){
// (생략)
        }
        //re-insert failed files
        if (del){
            if (result2.length > 0){
                await conn.query(str6, [result2]);
            }
        }
    }
// (생략)
    cnt++;
}
```

### 3. transaction에 포함되는 사항 변경 및 쿼리 계획 점검

도중에 바뀌지 않는 사항인 해당 폴더의 소유권 확인을 transaction 이전에 시행하고, atomicity가 필요한 MongoDB file_data 및 물리적 파일 복제를 transaction 도중에 처리하도록 수정했습니다.

또한 쿼리 계획 및 잠금 상황을 참고하여 
1. 복사 작업에서는 복사 대상 파일에 대해 for update 대신 for share로 select 작업을 진행하고 [(링크 - 2번 항목)](copymove_queries.md#recursive-copy-등-나머지-작업),
2. 재귀적 복사에 사용되는, inner join을 사용하는 쿼리의 경우 ALL 스캔이 아닌 인덱스 사용이 일어나도록 where 조건을 추가했으며 [(링크 - 앞 부분)](copymove_queries.md#recursive-copy-등-나머지-작업),
3. copy_origin을 clear하는 작업에서 불필요한 잠금을 방지하고 사용자의 모든 파일을 스캔하는 상황 방지를 위해 1 개의 인덱스를 추가하였습니다 [(링크)](copymove_queries.md#copy_origin-정리).

자세한 사항은 [copymove_queries.md](copymove_queries.md)를 참고하시기 바랍니다.