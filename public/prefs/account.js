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
	}, undefined, '');
});