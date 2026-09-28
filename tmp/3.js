const cv = document.getElementById('canvas');
const ctx = cv.getContext('2d', {willReadFrequently: true});

document.getElementsByTagName('input')[0].addEventListener('change', (e) => {
    const img = new Image();
    img.onload = () => {
        cv.width = img.width;
        cv.height = img.height;
        ctx.clearRect(0, 0, cv.width, cv.height);
        ctx.filter = 'grayscale(1) blur(2px)';
        ctx.drawImage(img, 0, 0);
        let imageData = ctx.getImageData(0, 0, cv.width, cv.height);
        const mag = sobel(imageData, cv.width, cv.height);
        showEdges(imageData, mag);
        ctx.putImageData(imageData, 0, 0);
    }

    const fileReader = new FileReader();
    fileReader.onload = (event) => {
        img.src = event.target.result;
    }
    fileReader.readAsDataURL(e.target.files[0]);
})

// оператор Собеля: две свёртки 3x3 - по X и по Y
const GX = [-1, 0, 1,
            -2, 0, 2,
            -1, 0, 1];
const GY = [ 1,  2,  1,
             0,  0,  0,
            -1, -2, -1];

const sobel = (imageData, w, h) => {
    const src = imageData.data;
    const mag = new Float32Array(w * h);
    for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
            let gx = 0, gy = 0, k = 0;
            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++, k++) {
                    // картинка уже ч/б, берём любой канал (r)
                    const v = src[((y + dy) * w + (x + dx)) * 4];
                    gx += v * GX[k];
                    gy += v * GY[k];
                }
            }
            mag[y * w + x] = Math.sqrt(gx * gx + gy * gy);
        }
    }

    return mag;
}

const showEdges = (imageData, mag) => {
    let max = 0;
    for (const v of mag) {
        if (v > max) max = v;
    }
    const dst = new Uint32Array(imageData.data.buffer);
    for (let i = 0; i < mag.length; i++) {
        const g = Math.min(255, mag[i] / max * 255);
        dst[i] = 0xFF000000 | (g << 16) | (g << 8) | g;
    }
}
