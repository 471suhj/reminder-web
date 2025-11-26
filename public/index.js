import {doFetch, showProgressMessage} from '/printmsg.js';

const divPopup = document.getElementById('popup');
const txtID = document.getElementById('signin_id');
const txtPW = document.getElementById('signin_password');
const lblSignMsg = document.getElementById('signin_message');
const txtEncoder = new TextEncoder();
const intEncrMaxCnt = 3;

let strPubKey = null;
let tryCnt = 0;

function clearSignup(){
    divPopup.style.display = 'none';
    for (const ctlItem of divPopup.children){
        if (ctlItem.type === 'text' || ctlItem.type === 'password'){
            ctlItem.value = '';
        }
        if (ctlItem.type === 'checkbox'){
            ctlItem.checked = false;
        }
    }
}

document.getElementById('signup').addEventListener('click', function(){
    divPopup.style.display = 'block';
});

document.getElementById('signin_google').addEventListener('click', function(){

});

async function sendPWReq(jsnReq, strLink, process, processFail){
    let jsnReqOld = {};
    Object.assign(jsnReqOld, jsnReq);
    if (tryCnt < intEncrMaxCnt){
        if (strPubKey === null){
            await doFetch('/auth/encr', 'GET', '', '', '정상적인 서버 통신에 실패했습니다.', async function(result){
                strPubKey = (await result.json()).value;
            });
        }
        if (strPubKey === null){
            return;
        }
        showProgressMessage('처리 중입니다.');
        const ckPubKey = await window.crypto.subtle.importKey('jwk', strPubKey, {name: 'RSA-OAEP', hash: 'SHA-256'}, false, ['encrypt']);
        const abPWEncr = await window.crypto.subtle.encrypt({name: 'RSA-OAEP'}, ckPubKey, txtEncoder.encode(jsnReq.password));
        jsnReq.password = btoa(String.fromCharCode(...new Uint8Array(abPWEncr)));
        jsnReq.key = strPubKey;
    } else {
        jsnReq.nokey = true;
    }
    await doFetch(strLink, 'POST', JSON.stringify(jsnReq), '',
    '', async function(result){
        const jsnRes = await result.json();
        if (jsnRes.success === true){
            tryCnt = 0; // otherwise a series of sign ups with long intervals would result in nokey state being used
            process();
        } else if (jsnRes.expired === true && tryCnt < intEncrMaxCnt) {
            strPubKey = null;
            tryCnt++;
            await sendPWReq(jsnReqOld, strLink, process, processFail);
        } else if (jsnRes.expired === true){ // shouldn't happen
            alert('정상적인 서버 통신에 실패했습니다.');
        } else {
            processFail(jsnRes.message);
        }
    }, function(){
        alert('정상적인 서버 통신에 실패했습니다.');
    });
    
}

document.getElementById('signin').addEventListener('click', async function(){
    if (txtID.value === '' || txtPW.value === ''){
        lblSignMsg.innerText = '아이디 또는 비밀번호를 입력해 주십시오.'
        return;
    }
    await sendPWReq({id: txtID.value, password: txtPW.value}, '/auth/auth', function(){
        showProgressMessage('로그인 중입니다.');
        window.location.href = '/home';
    }, function(msg){
        lblSignMsg.innerText = msg;
    });
});

const lblIDUnique = document.getElementById('signup_id_unique');
const lblPWValid = document.getElementById('signup_pw_valid');
const lblPWMatch = document.getElementById('signup_pw_match');
const txtSignupID = document.getElementById('signup_id');
const txtSignupUsername = document.getElementById('signup_username');
const txtSignupPW1 = document.getElementById('signup_password1');
const txtSignupPW2 = document.getElementById('signup_password2');
const chkAgree = document.getElementById('signup_agree');
const lblSignupMsg = document.getElementById('signup_msg');

txtSignupID.addEventListener('input', function(){
    txtSignupID.value = txtSignupID.value.trim();
    if (txtSignupID.value.length < 7){
        lblIDUnique.innerText = '7자 이상의 아이디를 입력하십시오';
        lblIDUnique.dataset.valid = 'false';
    } else {
        doFetch('/auth/signup', 'PUT', JSON.stringify({action: 'checkid', id: txtSignupID.value}), '', '', async function(result){
            const jsnRes = await result.json();
            if (jsnRes.valid === true){
                lblIDUnique.innerText = '사용 가능한 아이디입니다.';
                lblIDUnique.dataset.valid = 'true';
            } else if (jsnRes.alreadyExists === true) {
                lblIDUnique.innerText = '이미 사용중인 아이디입니다.';
                lblIDUnique.dataset.valid = 'false';
            } else {
                lblIDUnique.innerText = jsnRes.message;
                lblIDUnique.dataset.valid = 'false';
            }
        }, function(){
            lblIDUnique.innerText = '서버와의 통신에 실패했습니다.';
            lblIDUnique.dataset.valid = 'false';
        });
    }
});

txtSignupUsername.addEventListener('change', function(){
    txtSignupUsername.value = txtSignupUsername.value.trim();
})

function checkSignupPWMatch(){
    if (txtSignupPW1.value === txtSignupPW2.value){
        lblPWMatch.innerText = '비밀 번호가 일치합니다.';
        lblPWMatch.dataset.valid = 'true';
    } else {
        lblPWMatch.innerText = '비밀 번호가 일치하지 않습니다.';
        lblPWMatch.dataset.valid = 'false';
    }
}

txtSignupPW1.addEventListener('input', function(){
    txtSignupPW1.value = txtSignupPW1.value.trim();
    if (txtSignupPW1.value.length < 7){
        lblPWValid.innerText = '7자 이상의 비밀 번호를 입력하십시오';
        lblPWValid.dataset.valid = 'false';
    } else {
        lblPWValid.innerText = '사용 가능한 비밀 번호입니다.';
        lblPWValid.dataset.valid = 'true';
    }
    checkSignupPWMatch();
});

txtSignupPW2.addEventListener('input', function(){ // allows spaces in between.
    txtSignupPW2.value = txtSignupPW2.value.trim();
    checkSignupPWMatch();
});

document.getElementById('signup_ok').addEventListener('click', async function(){
    if (lblIDUnique.dataset.valid !== 'true'){
        lblSignupMsg.innerText = '사용할 수 없는 아이디입니다.';
        return;
    }
    if (!txtSignupUsername.value){
        lblSignupMsg.innerText = '사용자 이름을 입력해 주십시오.';
        return;
    }
    if (lblPWValid.dataset.valid !== 'true'){
        lblSignupMsg.innerText = '유효하지 않은 비밀 번호입니다.';
        return;
    }
    if (lblPWMatch.dataset.valid !== 'true'){
        lblSignupMsg.innerText = '두 비밀번호가 일치하지 않습니다.';
        return;
    }
    if (!chkAgree.checked){
        lblSignupMsg.innerText = '개인정보 처리방침 및 이용 약관에 동의해야 회원 가입이 가능합니다.';
        return;
    }

    await sendPWReq({id: txtSignupID.value, pw: txtSignupPW2.value, username: txtSignupUsername.value}, '/auth/signup', function(){
        lblSignupMsg.innerText = '회원 가입이 정상적으로 완료되었습니다. 회원 가입한 계정으로 로그인해 주시기 바랍니다.';
        clearSignup();
    }, function(msg){
        alert('회원 가입이 실패했습니다.\n' + msg);
    });
});

document.getElementById('signup_cancel').addEventListener('click', function(){
    clearSignup();
});
