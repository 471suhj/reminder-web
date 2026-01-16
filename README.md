# 프로젝트 소개

## 주요 프로젝트

- [**reminder-web**](#reminder-web의-소개) (현재 프로젝트) (ComphyCat Reminder Online)
    
    NestJS를 사용한 백엔드 위주의 TypeScript 프로젝트

    Reminder20의 온라인 버전

## 참고용 프로젝트

- [**Reminder94**](https://github.com/471suhj/Reminder94)

    Win32 API를 직접적으로 호출하는 C++ 프로젝트 (개발 초기 단계)

    2025/08/27 ~ 2025/09/08

    Reminder20의 새 버전
- [**Reminder20**](https://github.com/471suhj/Reminder20) (ComphyCat Reminder)

    Visual Basic .NET 프로젝트

    2018/01 ~ 2021/10, 2025/12/23 ~ 2026/01/04

    Reminder94로 이어서 개발 예정

# reminder-web의 소개

## 서비스 정보

- 개발 기간: 2025/10/29 ~ 2026/01/15
- 개발자: 서정욱
- 프로젝트 구분: 백엔드 위주의 프로젝트
- 서비스 이름: ComphyCat Reminder Online
- 서비스 내용: Reminder20으로 작성한 파일들을 온라인 개인 저장소에 저장하고, 편집하며, 친구들과 공유할 수 있는 서비스
- 서비스 이용 안내: **현재 Amazon SES의 production access가 승낙되지 않은 상태로, 사전 지정된 이메일 주소 이외에는 인증번호를 발송할 수 없는 상황입니다. 회원 가입을 희망하시는 분께서는 이메일을 secret@comphycat.uk, 인증 번호를 '케이크'로 입력해 주시면 자동 인증 처리됩니다. 문제가 발생하는 경우 comtrams@outlook.com으로 문의 부탁드립니다. 감사합니다.**
- 서비스 링크: https://comphycat.uk
- 서비스 소개 영상: https://youtu.be/mEFtugIuUmM
- 쿼리 설정 등 참고 사항: [READUS 폴더 참고](READUS)
- 참고 사항: 

    프런트엔드 위주로 제작한 프로젝트가 아닌 관계로 웹 페이지의 사용자 경험이 이상적이지 않다는 것을 양해 부탁드립니다. 특히 대부분의 키보드 단축키는 작동하지 않을 가능성이 높습니다.

    또한 시간적인 한계로 인해 아직 구현되지 않은 기능이 있습니다. 프로젝트의 규모 및 시간적인 문제로 인해 완성되지 않은 기능이 있으니 양해 부탁드립니다. 특히 회원 정보 변경의 기능들 (이름, 비밀 번호 변경 등)과 파일 편집 기능은 아직 구현되지 않았습니다.

## 개발 환경 및 사용 기술

- **언어 및 Framework**: TypeScript, Node.js, NestJS (Express 바탕)

    client-side: JavaScript, CSS3, HTML5 (Handlebars 이용)
- **데이터베이스**: MySQL 8.0.44, MongoDB 7.0.28

    MySQL 연결: mysql2, TypeORM (일부 코드의 경우)

    MongoDB 연결: Node.js MongoDB driver

- **배포**: Amazon Web Services (AWS) EC2 (도메인: CloudFlare, 이메일 전송: Amazon SES)
- **개발 환경**: Windows Subsystem for Linux (WSL2): Ubuntu 24.04.3 on Windows 11 25H2, Visual Studio Code (WSL2)

## Entity-Relationship Diagram

원본: [READUS/reminder-web-er.pptx](READUS/reminder-web-er.pptx)

이미지: [READUS/reminder-web-er.bmp](READUS/reminder-web-er.bmp)

![E-R Diagram 대체 텍스트](READUS/reminder-web-er.bmp)

### 참고
- 해당 다이어그램은 Relational Dababase가 아닌 MongoDB의 컬렉션은 포함하지 않습니다.
- 해당 다이어그램은 E-R 모델로, 실제로 사용된 relation schema와 차이가 있습니다.
- MySQL과 MongoDB에 실제로 사용된 테이블과 컬렉션 구성은 [바로 다음 문단](#relation-schema--mongodb-collections)을 참고하세요.

## Relation Schema & MongoDB collections

- MySQL의 Relation Schema 구성: [READUS/mysql_plan.txt](READUS/mysql_plan.txt)

- MongoDB의 Collection 구성: [READUS/mongo_plan.txt](READUS/mongo_plan.txt)

## API 문서

https://comphycat.uk/api

참고: 
- 현재 `files`에 대한 API 문서만 설명 및 예시 입력 형식을 제공합니다.
- `files`의 모든 명령은 로그인이 이루어져 token이 쿠키로 전달되는 상황에서만 작동합니다.

## 프로젝트 코드의 구성

- **폴더의 구성**
    
    `src`에 백엔드 코드가, `views`에 HTML 응답을 위한 hbs 파일들이 존재합니다. HTML 페이지들의 CSS 파일 및 JavaScript 스크립트들은 `public` 폴더에 존재합니다.

- **src 폴더의 구성**

    이 프로젝트의 코드는 전반적으로 로그인 지원, 홈 화면, 회원 정보, 파일시스템 및 친구 지원으로 구분될 수 있습니다.

- **로그인 지원**

    **auth**: 로그인 과정 지원, Google 로그인 지원

    **hash-password**: 암호화 관련 사항 처리 (이메일 인증 정보 암호화, 비밀 번호 암호화 및 해싱, 비밀 번호 대조, 이메일 인증 번호 발급)

    **signup**: 회원 가입 작업 지원: 회원 정보 생성, 아이디 중복 확인, 이메일 인증번호 발송 지원 (인증번호 생성은 `hash-password`에서) 및 인증 처리

- **홈 화면**

    **home**: 사용자 홈 화면 및 알림 화면 관리, 알림 수신 처리

- **회원 정보**

    **graphics**: 프로필 사진 표시

    **prefs**: 회원 설정 및 환경 설정 관리, 프로필 사진 업데이트, 로그인 이후 대부분의 창에 기본 회원 정보 제공

    **user**: 사용자 일련 번호 (`user_serial`)를 추출하는 `User` 데코레이터 위치

- **파일시스템 및 친구 지원**

    **check-integrity**: 데이터베이스의 상태에 결함이 없는지 점검. 현재 하나의 `friend` 레코드에 대응하는 `friend_mono` 레코드가 두 개가 맞는지 점검에 사용.

    **files (주요 모듈)**: 파일시스템 처리 과정의 전반을 관할. 서버의 파일시스템이 아닌, MySQL과 MongoDB를 통해 구현되어 사용자의 입장에서 본인의 온라인 개인 저장소 관련 작업을 관할

    **friends**: 사용자가 추가한 친구와 관련된 사항들을 관할

- **기타**

    **aws**: Amazon SES를 위한 SDK 설정

    **delete-expired**: 기한이 지난 레코드 삭제. 회원 탈퇴 처리 후 지정된 기간이 지난 사용자, 일정 시한이 지난 삭제된 파일 및 (사본 공유 기능을 통해) 받은 파일, 지정된 기간이 지난 알림 삭제.

    **header**: 캐싱 설정을 지정하는 Response Header 설정

    **mongo**: MongoDB Driver의 연결 설정 및 기능 제공.

    **mysql**: `mysql2`의 MySQL 연결 설정 및 기능 제공, transaction 함수 제공. `mysql2`와는 별개로 TypeORM Entity 저장.

## 문제 해결

### 1. 파일 업로드 문제 해결

자세한 설명: [READUS/troubleshoot_upload/troubleshoot_upload.md](READUS/troubleshoot_upload/troubleshoot_upload.md)

파일 업로드 과정에서 두 가지의 문제가 발생했습니다. 첫 번째는 파일 업로드 과정에서 오류가 발생하면 응답이 반환되지 않는 문제였고, 두 번째는 3개의 파일을 한 번에 선택해 업로드했을 때 MySQL에 deadlock이 발생 (그 결과 앞의 문제에 따라 응답이 반환되지 않았습니다.)하는 문제였습니다.

우선 요청이 반환되지 않는 문제는 breakpoint와 step over를 활용해 파악할 수 있었습니다. 오류가 발생할 경우 `busboy`를 통한 파일 업로드 스트림 (`Readable`)을 `destroy()`하도록 코드를 구성했는데, 그 결과 `busboy` (`EventEmitter`를 구현)가 `close`하지 않아서 코드가 반환되지 않는 것이었습니다.

따라서 `busboy`의 공식 문서를 참고하여 `Readable`을 `resume()`하도록 수정하여 첫 번째 문제는 해결했습니다.

두 번째 문제인 MySQL deadlock은 MySQL의 General Log를 통해 원인을 발견할 수 있었습니다. 파일 업로드를 처리하는 코드는 `busboy`가 `EventEmitter`를 구현하는 방식이기 때문에 busboy의 `'file'` 이벤트 핸들러에 구현했습니다. `EventEmitter`는 이벤트 핸들러가 Promise를 반환하는 경우를 별도로 처리하지 않으며, 저는 각 `file` 이벤트에 대해서 asynchronous MySQL transaction을 진행하도록 코드를 구성했습니다.

결과적으로 각 파일의 MySQL transaction은 거의 동시에 진행되게 되었고, 따라서 deadlock이 발생했다는 것을 General Log를 통해 확인할 수 있었습니다. 따라서 하나의 파일 처리가 끝난 후에 다음 파일 처리가 진행되도록 코드를 수정했습니다.

또한 서로 다른 곳에서 동시에 업로드하는 경우를 대비하여 deadlock 오류가 발생하면 재시도를 하도록 코드를 수정했습니다.

### 2. 복사/이동 기능 개선 및 최적화

자세한 설명: [READUS/troubleshoot_copymove/troubleshoot_copymove.md](READUS/troubleshoot_copymove/troubleshoot_copymove.md)

기존 `FilesService.moveFiles_rename()`을 비롯하여 파일의 복사/이동 기능의 코드는 많은 양의 쿼리로 코드가 매우 복잡하고 가독성이 좋지 않았으며, 그 결과 디버깅에도 어려움이 있었습니다.

이를 해결하기 위해 `FilesController.putMove()`의 코드는 가독성을 고려하여 수정했으며, 매우 많은 양의 쿼리를 호출했던 `FilesService.moveFiles_rename()`의 경우 파일을 한 번에 하나씩 처리하는 방식으로 코드를 새로 작성했습니다. 또한 주요 기능이지만 동시에 쿼리 호출 빈도가 높은 기능이기 때문에 쿼리 계획 점검 및 최적화 또한 진행했습니다.

- 코드 가독성의 개선

    다양한 단계를 거치는 함수로 구성이 되어 있으므로 각 작업별로 코드 사이에 줄을 띄웠습니다.

    변수의 이름을 직관적으로 파악이 되도록 수정했습니다. 특히 `resDup`, `arrDup`과 같이 이름만으로는 차이를 파악하기 어려운 변수들이 없도록 수정했으며, 같은 변수가 함수의 앞부분과 뒷부분에서 서로 다른 형태의 값을 배정받지 않도록 수정했습니다. 

    한 곳에서만 일시적으로 등장하는 변수들의 관리를 위하여 block을 설정하여 변수들을 일부 정리했습니다.

    길이가 긴 코드에서 불필요한 destructuring은 변수의 배정 방식을 파악하기 어렵다고 판단하여 대신 일반 object를 반환하는 방식으로 바꾸었습니다. 다만 block 내에 존재하는 코드의 경우 destructuring 방식을 유지하기도 했습니다.

- `moveFiles_rename()` 코드 재작성

    기존 코드는 이동 대상인 파일 중 목적지에 이미 같은 이름이 있는 파일을 대상으로, 이름이 충돌되지 않도록 수정하는 작업을 모든 파일에 한 번에 적용했습니다. 애플리케이션 코드상으로 레코드를 다루기보다는 중간 데이터를 MySQL에 두고 이름을 수정해 가면서 쿼리를 처리하는 방식으로, 하나의 쿼리에서 이름 충돌이 있는 모든 파일을 한 번에 다루는 것은 예상보다 많은 상황에 대한 처리가 필요했고 매우 많은 양의 쿼리를 요구했습니다.

    이에 중간 데이터를 MySQL에 두고 여러 파일을 동시에 처리하는 기존 방식은 과도하게 복잡하다는 문제가 있고, 중간 데이터를 애플리케이션 코드가 관리하는 것은 ORM을 사용하지 않는 해당 함수의 경우에는 어렵다고 판단했습니다. 따라서 여러 파일을 동시에 처리하는 대신 파일을 하나씩 처리하도록 코드를 재작성하였고, 실질적으로 호출되는 쿼리의 양은 많아도 쿼리의 종류는 단순한 코드를 작성할 수 있었습니다.

- 쿼리 계획 점검 및 최적화

    쿼리의 실행 계획과 잠금 상황을 파악한 후 다음의 사항을 수정했습니다.
    
    - 불필요한 전체 탐색 및 과도한 잠금을 방지하기 위한 인덱스를 하나 추가했습니다. [(링크)](READUS/troubleshoot_copymove/copymove_queries.md#copy_origin-정리)
    
    - 복사의 경우 원본 파일에 대해 `select...for update` 대신 `select...for share`이 호출되오록 변경했습니다. [(링크 - 2번 항목)](READUS/troubleshoot_copymove/copymove_queries.md#recursive-copy-등-나머지-작업)

    - `inner join`을 사용하는 쿼리에서 join 대상인 두 번째 테이블에 조건이 부족하여 `ALL` 스캔이 일어나는 것을 발견하고 해당 테이블에 대한 where 조건을 추가했습니다. [(링크 - 앞 부분)](READUS/troubleshoot_copymove/copymove_queries.md#recursive-copy-등-나머지-작업)

    자세한 내용은 [READUS/troubleshoot_copymove/copymove_queries.md](READUS/troubleshoot_copymove/copymove_queries.md)를 참고하시기 바랍니다.

## 코드 고려 사항 - FilesModule 함수 구성

`FilesModlue`의 service들 (`FilesService`, `FileUtilsService`, `FileResolutionService`)의 함수는 둘 중 하나로 구성했습니다.

1. 함수가 읽기 전용으로 정보를 입력받은 후 결과를 반환합니다. 이때 읽기 전용으로 입력받는 정보는 변수가 밑줄(`_`)로 끝나도록 구성했습니다.

2. 함수가 수정 가능한 정볼르 입력받은 후 입력값 자체를 수정하며, 결과를 반환하지 않습니다.

이처럼 두 가지의 방식으로 함수를 정리함으로써 반환값이 있는 함수는 읽기 전용으로 내용을 입력받고, 반환값이 없는 함수는 입력값 자체를 변경한다는 것을 파악할 수 있도록 했습니다.

이를 통해 입력값을 변경하는 함수를 잘못 사용하여 생기는 버그를 방지할 수 있을 것이라고 생각합니다.

## 코드 고려 사항 - 쿠키, 캐싱

로그인 상태를 확인하는 쿠키의 이름을 `__Host-Http-userToken`으로 설정했습니다. 이를 통해 쿠키가 https 연결을 통해서만 설정되고 (`Secure`), JavaScript를 통해 접근할 수 없으며(`HttpOnly`), 쿠키를 보낸 host만이 해당 쿠키를 읽는 상황이 보장되도록 만들었습니다. [(참고 문서: Using HTTP cookies - MDN)](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Cookies#security)

또한 `Cache-Control` 헤더를 `private, no-cache`로 설정하여 proxy에서의 캐싱, 또는 request collape로 인해 다른 사용자에게의 노출이 발생하지 않고 (`private`), 창의 내용에 변화가 있을 경우 반드시 새로운 내용을 가져오도록 (`no-cache`) 구성했습니다. [(참고 문서: HTTP caching - MDN)](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Caching)

## 코드 고려 사항 - 파일 및 이미지 업로드

파일 (`FilesController.postManage()`가 호출하는 `FileUtilsService.uploadMongo()`) 및 이미지 업로드 (`PrefsController.putUpdateUploadprofimg()`)의 경우 `busboy`의 `Readable` (`node:stream`)을 통해 내용을 전달받으며, 동시에 여러 파일 업로드 요청을 받을 수 있기 때문에 메모리에 내용을 누적하지 않고 Readable의 이벤트에서 내용을 바로 처리하도록 코드를 구성하고 있습니다.
