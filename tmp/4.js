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
        const [x, y, w, h] = findFace(mag, cv.width, cv.height);
        ctx.putImageData(imageData, 0, 0);
        ctx.strokeStyle = 'red';
        ctx.lineWidth = 3;
        ctx.strokeRect(x, y, w, h);
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

// порог для бинарной маски границ - подобран опытным путём
const EDGE_TH = 100;

const findFace = (mag, w, h) => {
    // бинарная маска границ; рамки/поля скриншотов выкидываем сразу
    const mx = Math.round(w * 0.03), my = Math.round(h * 0.03);
    const mask = new Uint8Array(w * h);
    for (let y = my; y < h - my; y++) {
        for (let x = mx; x < w - mx; x++) {
            mask[y * w + x] = mag[y * w + x] > EDGE_TH ? 1 : 0;
        }
    }

    // "утолщаем" границы - иначе зеркальные пары не попадут друг в друга
    const DR = 2;
    const dil = new Uint8Array(w * h);
    for (let y = DR; y < h - DR; y++) {
        for (let x = DR; x < w - DR; x++) {
            if (mask[y * w + x]) {
                for (let dy = -DR; dy <= DR; dy++) {
                    for (let dx = -DR; dx <= DR; dx++) {
                        dil[(y + dy) * w + x + dx] = 1;
                    }
                }
            }
        }
    }

    // ось симметрии: для каждой колонки считаем, сколько границ
    // слева от неё имеют зеркальную пару справа; лица симметричны, фон - нет
    const YMAX = Math.round(h * 0.62); // головы живут в верхней части кадра
    const R = Math.round(w * 0.12);    // половина ожидаемой ширины лица
    let cx = mx, best = 0;
    for (let c = mx; c < w - mx; c++) {
        let score = 0;
        for (let d = 1; d <= R; d++) {
            for (let y = my; y < YMAX; y++) {
                score += dil[y * w + c - d] * dil[y * w + c + d];
            }
        }
        if (score > best) {
            best = score;
            cx = c;
        }
    }

    // ширина лица: плотность границ по колонкам вокруг оси
    const profX = new Float32Array(w);
    for (let x = 0; x < w; x++) {
        for (let y = 0; y < YMAX; y++) {
            profX[x] += mask[y * w + x];
        }
    }
    const sProfX = smooth(profX, Math.round(w * 0.02));
    const xTh = sProfX[cx] * 0.4;
    let l = cx;
    while (l > Math.max(0, cx - R) && sProfX[l] > xTh) l--;
    let r = cx;
    while (r < Math.min(w - 1, cx + R) && sProfX[r] > xTh) r++;

    // верх головы: первая строка с устойчивой плотностью границ в найденной полосе
    const profY = new Float32Array(h);
    for (let y = 0; y < h; y++) {
        for (let x = l; x <= r; x++) {
            profY[y] += mask[y * w + x];
        }
    }
    const sProfY = smooth(profY, Math.round(h * 0.02));
    let maxY = 0;
    for (let y = 0; y < h; y++) {
        if (sProfY[y] > sProfY[maxY]) maxY = y;
    }
    const yTh = sProfY[maxY] * 0.35;
    let top = 0;
    while (top < h && sProfY[top] < yTh) top++;

    // подбородок от торса/текста эвристикой не отделить,
    // берём классическую пропорцию: высота лица ~ 1.25 ширины
    const height = Math.min(h - top, Math.round((r - l) * 1.25));
    return [l, top, r - l, height];
}

const smooth = (p, k) => {
    const out = new Float32Array(p.length);
    for (let i = 0; i < p.length; i++) {
        let acc = 0, n = 0;
        for (let d = -k; d <= k; d++) {
            const j = i + d;
            if (j >= 0 && j < p.length) {
                acc += p[j];
                n++;
            }
        }
        out[i] = acc / n;
    }

    return out;
}
