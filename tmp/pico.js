// нужен index.html где вместо fr.js подключён pico.js и этот файл:
//   <script src="pico.js"></script>
//   <script src="face-pico.js" defer></script>
// а рядом лежит бинарный файл каскада `facefinder` из репозитория nenadmarkus/pico

const cv = document.getElementById('canvas');
const ctx = cv.getContext('2d', {willReadFrequently: true});

let classifyRegion = null;
fetch('facefinder')
    .then(response => response.arrayBuffer())
    .then(buffer => {
        classifyRegion = pico.unpack_cascade(new Int8Array(buffer));
    })

document.getElementsByTagName('input')[0].addEventListener('change', (e) => {
    const img = new Image();
    img.onload = () => {
        cv.width = img.width;
        cv.height = img.height;
        ctx.clearRect(0, 0, cv.width, cv.height);
        ctx.drawImage(img, 0, 0);

        // pico ждёт ч/б картинку однобайтовыми пикселями
        const rgba = ctx.getImageData(0, 0, cv.width, cv.height).data;
        const pixels = new Uint8Array(cv.width * cv.height);
        for (let i = 0; i < pixels.length; i++) {
            pixels[i] = Math.round(
                0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2]
            );
        }

        const image = {
            pixels: pixels,
            nrows: cv.height,
            ncols: cv.width,
            ldim: cv.width,
        };
        const params = {
            shiftfactor: 0.1,
            minsize: Math.min(cv.width, cv.height) * 0.15,
            maxsize: Math.min(cv.width, cv.height) * 0.9,
            scalefactor: 1.1,
        };

        let dets = pico.run_cascade(image, classifyRegion, params);
        dets = pico.cluster_detections(dets, 0.2);

        ctx.strokeStyle = 'red';
        ctx.lineWidth = 3;
        for (const [r, c, s, q] of dets) {
            if (q < 5.0) continue; // отсекаем слабые срабатывания
            ctx.strokeRect(c - s / 2, r - s / 2, s, s);
        }
    }

    const fileReader = new FileReader();
    fileReader.onload = (event) => {
        img.src = event.target.result;
    }
    fileReader.readAsDataURL(e.target.files[0]);
})
