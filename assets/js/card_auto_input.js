$(function() {
    let videoStream;

    $('#js-cameraTrigger').on('click', function() {
        $('#cameraModal').css('display', 'block');

        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: { ideal: 'environment' }
                }
            }).then(function(stream) {
                videoStream = stream;
                const video = $('<video autoplay playsinline></video>');
                $('.cameraMain').html(video);
                video[0].srcObject = stream;

                // カード枠
                const frame = $('<div class="cardFrame"></div>');
                $('.cameraMain').append(frame);
                frame.css({
                    'position': 'absolute',
                    'top': '50%',
                    'left': '50%',
                    'transform': 'translate(-50%, -50%)',
                    'width': '80%',
                    'aspect-ratio': '1.586 / 1',
                    'border': '4px solid white',
                    'box-sizing': 'border-box'
                });
            }).catch(function(err) {
                console.error("カメラのアクセス失敗: ", err);
                alert("カメラのアクセス拒否");
            });
        } else {
            alert("ブラウザのカメラ未対応");
        }
    });

    // グレースケールとコントラスト強調処理
    const preprocessImage = (canvas) => {
        const ctx = canvas.getContext('2d');
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        // グレースケール変換
        for (let i = 0; i < data.length; i += 4) {
            const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
            data[i] = avg; // R
            data[i + 1] = avg; // G
            data[i + 2] = avg; // B
        }

        // コントラスト強調
        const contrastFactor = 1.5; // 倍率
        for (let i = 0; i < data.length; i += 4) {
            data[i] = Math.min(255, data[i] * contrastFactor);
            data[i + 1] = Math.min(255, data[i + 1] * contrastFactor);
            data[i + 2] = Math.min(255, data[i + 2] * contrastFactor);
        }

        ctx.putImageData(imageData, 0, 0);
    };

    // 画像読込の処理
    $('.cameraBtn').on('click', function() {
        const videoElement = $('.cameraMain video')[0];

        // canvasの作成とフレーム取得
        const canvas = document.createElement('canvas');
        canvas.width = videoElement.videoWidth;
        canvas.height = videoElement.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

        // カード枠の位置・サイズ取得
        const frameElement = $('.cardFrame')[0];
        const frameRect = frameElement.getBoundingClientRect();
        const videoRect = videoElement.getBoundingClientRect();

        // カード枠のエリア計算
        const scaleX = videoElement.videoWidth / videoRect.width;
        const scaleY = videoElement.videoHeight / videoRect.height;
        const cardArea = {
            x: (frameRect.left - videoRect.left) * scaleX,
            y: (frameRect.top - videoRect.top) * scaleY,
            width: frameRect.width * scaleX,
            height: frameRect.height * scaleY
        };

        // カード枠をOCR処理の対象にしてcanvas描画
        const croppedCanvas = document.createElement('canvas');
        croppedCanvas.width = cardArea.width;
        croppedCanvas.height = cardArea.height;
        const croppedCtx = croppedCanvas.getContext('2d');
        croppedCtx.drawImage(canvas, cardArea.x, cardArea.y, cardArea.width, cardArea.height, 0, 0, cardArea.width, cardArea.height);

        // グレースケールとコントラスト強調処理
        preprocessImage(croppedCanvas);

        // OCR処理
        Tesseract.recognize(
            croppedCanvas, 
            'eng', 
            { logger: function(m) { console.log(m); } }
        ).then(function(result) {
            console.log(result.data.text);

            // 認識結果からクレジットカード情報を抽出して各フィールドに入れる
            const recognizedText = result.data.text;
            const cardNumber = recognizedText.match(/\d{4} \d{4} \d{4} \d{4}/);
            const expiryDate = recognizedText.match(/(\d{2}\/\d{2})/);
            const cardName = recognizedText.match(/[A-Z\s]+/);

            if (cardNumber) {
                $('#cardNumber').val(cardNumber[0].replace(/\s+/g, ''));
            }
            if (expiryDate) {
                const [month, year] = expiryDate[0].split('/');
                $('#cardExpirationMonth').val(month);
                $('#cardExpirationYear').val('20' + year);
            }
            if (cardName) {
                $('#cardName').val(cardName[0].trim());
            }

            // カメラモーダルを閉じる
            $('#cameraModal').css('display', 'none');

            // カメラを停止
            if (videoStream) {
                videoStream.getTracks().forEach(track => track.stop());
            }
        }).catch(function(err) {
            console.error("OCRに失敗: ", err);
            alert("カード読み取り失敗");
        });
    });
});
