function printJson(value) {
    console.log(JSON.stringify(value, null, 2));
}

function printText(lines) {
    if (Array.isArray(lines)) {
        console.log(lines.join('\n'));
        return;
    }
    console.log(String(lines));
}

module.exports = {
    printJson,
    printText,
};
