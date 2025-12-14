import { doFetch } from '/printmsg.js';
import { importNotice } from './settingsmgr.js';

const fleProfImg = document.getElementById('profImgFile');
const imgProf = document.getElementById('profImgFile');
fleProfImg.addEventListener('change', async event=>{
	if (fleProfImg.files.length <= 0){
		return;
	}
	const dat = new FormData();
	dat.append('file', fleProfImg.files[0]);
	await doFetch('/prefs/update/uploadprofimg', 'PUT', FormData, '', '이미지 파일 업로드에 실패했습니다.', async result=>{
		let jsnRes = await result.json();
		if (jsnRes.success){
			imgProf.src = '';
			await fetch('/graphics/profimg?cus=true');
			imgProf.src = '/graphics/profimg?cus=true';
		} else {
			showMessage('이미지 파일 업로드에 실패했습니다.');
		}
	}, undefined, 'FormData');
});

document.getElementById('delAccount').addEventListener('click', async ()=>{
	if (!confirm(정말로 회원을 탈퇴하시겠습니까?)){
		return;
	}
	await doFetch('/prefs/update/delaccount', 'PUT', '', '', '', async result=>{
		alert('회원 탈퇴가 완료되었습니다.');
		window.href = '/';
	}, async ()=>{
		alert('회원 탈퇴에 실패했습니다.');
	});
});