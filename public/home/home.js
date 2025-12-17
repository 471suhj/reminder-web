import {loadNotificationDetails} from './notification.detail.js';

const divPopup = document.getElementById('popup');

let items = document.getElementsByClassName('listContent');
for (const listItem of items){
    listItem.addEventListener('click', function(){
        if (listItem.dataset.popup === 'notif'){
            loadNotificationDetails(listItem, listItem.dataset.link);
        } else if (listItem.dataset.popup === 'newwin'){
            window.open(listItem.dataset.link);
        } else {
			window.location.href = listItem.dataset.link;
		}
    })
}