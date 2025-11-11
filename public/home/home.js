import {loadNotificationDetails} from "./notification.detail.js"

const divPopup = document.getElementById("popup");

let items = document.getElementsByClassName("listContent");
for (const listItem of items){
    listItem.addEventListener("click", function(){
        if (listItem.dataset.popup === "true"){
            loadNotificationDetails(divPopup, listItem, document);
        } else {
            window.open(listItem.dataset.link);
        }
    })
}