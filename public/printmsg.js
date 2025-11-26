let lblMsgBox = null;
document.getElementById('frame').appendChild(lblMsgBox = document.createElement('div'));
lblMsgBox.setAttribute('id', 'messageBox');
lblMsgBox.setAttribute('data-show', 'false');
lblMsgBox.addEventListener('mouseleave', function(event){
    event.target.dataset.show = 'false';
})

export function showMessage(message){
    lblMsgBox.innerText = message;
    lblMsgBox.dataset.show = 'true';
    setTimeout(() => {
        lblMsgBox.dataset.show = 'false';
    }, 5000);
}

export function showProgressMessage(message){
    lblMsgBox.innerText = message;
    lblMsgBox.dataset.show = 'true';
}

export function hideMessage(){
    lblMsgBox.dataset.show = 'false';
}

export async function doFetch(link, method, data, msgSuccess, msgFail, process, fprocess, isText){
    try{
        let result = null;
        showProgressMessage('처리 중입니다...');
        if (data === ''){
            result = await fetch(link, {method: method});
        } else if (isText) {
            result = await fetch(link, {method: method, headers: {'Content-Type': 'text/plain'}, body: data});
        } else {
            result = await fetch(link, {method: method, headers: {'Content-Type': 'application/json'}, body: data});
        }
        if (!result.ok) {
            throw new Error(`result error: status ${result.status}`);
        }
        let msg = await process(result);
        if (msgSuccess !== '' || (msg !== '' && msg !== undefined)){
            showMessage(msgSuccess + msg);
        } else {
            hideMessage();
        }
    } catch (error) {
        if (error instanceof Error){
            showMessage(`${msgFail}\n오류: ${error.message}`);
        } else {
            showMessage(msgFail);
        }
        if (fprocess !== undefined){
            fprocess();
        }
    }
}
