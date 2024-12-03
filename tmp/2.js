const cv = document.getElementById('canvas');
const ctx = cv.getContext('2d', {willReadFrequently: true});

document.getElementsByTagName('input')[0].addEventListener('change', (e) => {
    const img = new Image();
    img.onload = () => {
        cv.width = img.width;
        cv.height = img.height;
        ctx.clearRect(0, 0, cv.width, cv.height);
        ctx.drawImage(img, 0, 0);
        let imageData = ctx.getImageData(0, 0, cv.width, cv.height);
        const dst = new Uint32Array(imageData.data.buffer);
        desaturate(dst);
        ctx.putImageData(imageData, 0, 0);
    }

    const fileReader = new FileReader();
    fileReader.onload = (event) => {
        img.src = event.target.result;
    }
    fileReader.readAsDataURL(e.target.files[0]);
})

const desaturate = src => {
    for (let i = 0; i < src.length; i++) {
        let r = src[i] & 0xFF;
        let g = (src[i] >> 8) & 0xFF;
        let b = (src[i] >> 16) & 0xFF;
        let gray = (r + g + b) / 3;
        src[i] = 0xFF000000 | (gray << 16) | (gray << 8) | gray;
    }

    return src;
}
