# 프로젝트 소개

## 주요 프로젝트

- [reminder-web](#reminder-web의-소개) (현재 프로젝트) (ComphyCat Reminder Online)
    
    NestJS를 사용한 백엔드 위주의 TypeScript 프로젝트

    Reminder20의 온라인 버전

## 참고용 프로젝트

- [Reminder94](../Reminder94)

    Win32 API를 직접적으로 호출하는 C++ 프로젝트 (개발 초기 단계)

    2025/08/27 ~ 2025/09/08

    Reminder20의 새 버전
- [Reminder20](../Reminder20) (ComphyCat Reminder)

    Visual Basic .NET 프로젝트

    2018/01 ~ 2021/10, 2025/12/23 ~ 2026/01/04

    Reminder94로 이어서 개발 예정

# reminder-web의 소개

## 서비스 정보

- 개발 기간: 2025/10/29 ~ 2026/01/11
- 개발자: 서정욱
- 프로젝트 구분: 백엔드 위주의 프로젝트
- 서비스 이름: ComphyCat Reminder Online
- 서비스 내용: Reminder20으로 작성한 파일들을 온라인 개인 저장소에 저장하고, 편집하며, 친구들과 공유할 수 있는 서비스
- 서비스 링크: https://comphycat.uk
- 서비스 소개 영상: 
- 쿼리 설정 등 참고 사항: [READUS 폴더 참고](READUS)
- 참고 사항: 

    프런트엔드 위주로 제작한 프로젝트가 아닌 관계로 웹 페이지의 사용자 경험이 이상적이지 않다는 것을 양해 부탁드립니다. 특히 대부분의 키보드 단축키는 작동하지 않을 가능성이 높습니다.

    또한 시간적인 한계로 인해 아직 구현되지 않은 기능이 있습니다. 프로젝트의 규모 및 복학 일정이라는 시간적인 문제로 인해 완성되지 않은 기능이 있으니 양해 부탁드립니다. 특히 회원 정보 변경의 기능들 (이름, 비밀 번호 변경 등)과 파일 편집 기능은 아직 구현되지 않았습니다.

## 개발 환경 및 사용 기술

- 언어 및 Framework: TypeScript, Node.js, NestJS (Express 바탕)

    client-side: JavaScript, CSS3, HTML5 (Handlebars 이용)
- 데이터베이스: MySQL 8.0.44, MongoDB 7.0.28

    MySQL 연결: mysql2, TypeORM (일부 코드의 경우)

    MongoDB 연결: Node.js MongoDB driver

- 배포: Amazon Web Service (AWS) EC2 (도메인: CloudFlare, 이메일 전송: Amazon SES)
- 개발 환경: Windows Subsystem for Linux 2 (WSL2): Ubuntu 24.04.3 on Windows 11 25H2, Visual Studio Code (WSL2)

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

```
collection - notification
	_id: ObjectId
	read: boolean
	to: number
	type: string
	data: object
	urlArr: [string(caption), string(link)][]

<data>
type - file_shared_hard
	sender_ser: number
	file_name: string
	mode: 'edit'|'read'
	fileid: number
	message: string

type - file_shared_inbox
	sender_ser: number
	file_name: string
	file_ser: number
	saved: boolean
	message: string

type - file_unshared
	sender_ser: number
	file_name: string
	file_ser: number
	message: string

type - friend_request_accepted
	sender_ser: number

type - friend_request
	sender_ser: number

type - friend_request_rejected
	sender_ser: number


collection - file_data
	serial: number
	user_serial: number
	type: 'rmb0.2'|'rmb0.3'
	arrlen: number
	metadata: {Interval?: number, FontSize?: number, RemStart?: number, RemEnd?: number}

use reminder_web;

db.notification.createIndex({to: 1, read: 1, _id: 1});
db.notification.createIndex({to: 1, _id: 1});

db.file_data.createIndex({serial: 1}, {unique: true});
```

## API 문서

https://comphycat.uk/api

참고: 
- 현재 files에 대한 API 문서만 제공합니다.
- files의 모든 명령은 로그인이 이루어져 token이 쿠키로 전달되는 상황에서만 작동합니다.

## 프로젝트 코드의 구성

## 코드 소개 - 데이터베이스 구성

## 코드 소개 - 회원 가입 및 로그인

## 코드 소개 - 파일시스템 함수 구성

## 코드 소개 - 친구 시스템

## 코드 고려 사항 - 쿠키

## 코드 고려 사항 - FormData

## 코드 고려 사항 - 파일 및 이미지 업로드

## 코드 고려 사항 - DTO 구성




1. code organization
code introduction:
2. the databases
3. signup and signin
4. the filesystem and function organizations
5. the friendsystem
code considerations
6. cookie policy
7. form submission policy
8. file and image uploading
9. dto organizations

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```