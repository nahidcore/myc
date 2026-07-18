const url =
"https://raw.githubusercontent.com/nahidcore/myc/main/arafat.c";

fetch(url)
.then(res => {
    if(!res.ok){
        throw new Error("File not found");
    }
    return res.text();
})
.then(code => {
    document.getElementById("code").textContent = code;
})
.catch(err => {
    document.getElementById("code").textContent =
        "Error: " + err.message;
});