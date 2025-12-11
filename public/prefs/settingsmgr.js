import { doFetch } from '/printmsg.js';

export importNotice = 'importing this module has side effects';

for (const chk of document.getElementsByClassName('chkItem').children){
	// does not fire when checkstate was changed programatically
	// fires after checked state is changed
	chk.addEventListener('change', async event=>{
		let destVal = chk.checked;
		chk.checked = !destVal;
		await doFetch('/prefs/update/' + chk.dataset.link, 'PUT', JSON.stringify({action: chk.dataset.action, checked: destVal}),
		'', '설정 변경에 실패했습니다.', async result=>{
			jsnRes = await result.json();
			if (jsnRes.success){
				chk.checked = destVal;
			} else {
				showMessage('설정 변경에 실패했습니다.');
			}
		});
	});
}