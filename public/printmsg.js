let lblMsg = null;
document.body.getElementsByClassName("frame")[0].appendChild(lblMsg = document.createElement("div"));
lblMsg.setAttribute("id", "messageBox");
lblMsg.setAttribute("data-show", "false");
lblMsg.addEventListener("mouseleave", function(event){
    event.target.dataset.show = "false";
})

export const showMessage = function(message){
    const lblMsgBox = document.getElementById("messageBox")
    lblMsgBox.innerText = message;
    lblMsgBox.dataset.show = "true";
    setTimeout(() => {
        lblMsgBox.dataset.show = "false";
    }, 5000);
}

export const doFetch = async function(link, method, data, msgSuccess, msgFail, process){
    try{
        let result = null;
        if (data === ""){
            result = await fetch(link, {method: method});
        } else {
            result = await fetch(link, {method: method, body: data});
        }
        if (!result.ok) {
            throw new Error(`result error: status ${result.status}`);
        }
        await process(result);
        if (msgSuccess !== ""){
            showMessage(msgSuccess);
        }
    } catch (error) {
        if (error instanceof Error){
            showMessage(`${msgFail}\n오류: ${error.message}`);
        } else {
            showMessage(msgFail);
        }
    }
}
