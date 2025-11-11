let abc = document.body.appendChild(document.createElement("div"))
abc.id = "abc"
abc.dataset.cake = "no"
abc.remove()
//let def = document.body.appendChild(document.createElement("div"))
//def.id = "abc"

console.log(document.getElementById("abc").dataset.cake)