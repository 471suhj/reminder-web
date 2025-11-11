let lblMsg = null;
document.getElementById("frame").appendChild(lblMsg = document.createElement("div"));
lblMsg.setAttribute("id", "messageBox");
lblMsg.setAttribute("data-show", "false");
lblMsg.addEventListener("mouseleave", function(event){
    event.target.dataset.show = "false";
})
const lblMsgBox = document.getElementById("messageBox")

export function showMessage(message){
    lblMsgBox.innerText = message;
    lblMsgBox.dataset.show = "true";
    setTimeout(() => {
        lblMsgBox.dataset.show = "false";
    }, 5000);
}

export function showProgressMessage(message){
    lblMsgBox.innerText = message;
    lblMsgBox.dataset.show = "true";
}

export function hideMessage(){
    lblMsgBox.dataset.show = "false";
}

export async function doFetch(link, method, data, msgSuccess, msgFail, process, fprocess){
    try{
        let result = null;
        showProgressMessage("처리 중입니다...");
        if (data === ""){
            result = await fetch(link, {method: method});
        } else {
            result = await fetch(link, {method: method, body: data});
        }
        if (!result.ok) {
            throw new Error(`result error: status ${result.status}`);
        }
        let msg = await process(result);
        if (msgSuccess !== "" || msg !== ""){
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
