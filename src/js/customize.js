import "core-js/stable";
import "regenerator-runtime/runtime";
import { KintoneRestAPIClient } from "@kintone/rest-api-client";
const client = new KintoneRestAPIClient();

(() => {
  "use strict";

  const myFunc = {
    getRecords: () => {
      // kintoneのレコードを全件取得する関数
      const app = kintone.app.getId();
      return client.record.getAllRecords({ app });
    },
    getImage: (fileKey) => {
      // kintoneのレコード内の添付ファイルをDLする関数
      return client.file.downloadFile({ fileKey });
    },
    ditectRecord: (ditectColor, records) => {
      // 判定した色からkintoneのレコードを特定する関数
      return records.find((val) => val.color === ditectColor);
    },
    checkColor: (imagedata) => {
      // 画像上のポイント ctx.getImageData(X, Y, H, W) を引数に10ピクセル×10ピクセルの平均RGBを返す関数
      let color;
      const [rr, gg, bb] = [[], [], []];

      // 10ピクセル×10ピクセル分値を計測
      for (let i = 0; i < 400; i = i + 4) {
        rr.push(imagedata.data[i]);
        gg.push(imagedata.data[i + 1]);
        bb.push(imagedata.data[i + 2]);
      }

      // RGBそれぞれの平均値を計算
      const sumArray = (arr) =>
        arr.reduce((sum, element) => sum + element, 0) / 100;
      const [r, g, b] = [sumArray(rr), sumArray(gg), sumArray(bb)];

      // RGBの値で色を特定する
      if (r < 100 && g < 100 && b < 100) {
        color = "black";
      }
      if (r > 230 && g > 230 && b > 230) {
        color = "white";
      }
      if (r > 200 && g < 100 && b < 110) {
        color = "red";
      }
      if (r > 200 && g > 150 && b < 200) {
        color = "yellow";
      }
      return [color, r, g, b];
    },
  };

  kintone.events.on("app.record.index.show", async (e) => {
    if (e.viewId !== 5697158) return;
    const obniz = new Obniz("");

    // kintoneのレコードから必要な情報を取得する
    const records = await myFunc.getRecords();
    const imageData = await Promise.all(
      records.map(async (record) => {
        const arrayBuffer = await myFunc.getImage(
          record["写真"].value[0].fileKey
        );
        const blob = new Blob([arrayBuffer], { type: "image/jpeg" });
        return {
          name: record["氏名"].value,
          company: record["会社名"].value,
          post: record["役職"].value,
          color: record["特徴"].value,
          imageUrl: URL.createObjectURL(blob),
        };
      })
    );

    // canvasにカメラ画像を埋め込む
    const canvas = document.getElementById("TestCanvas");
    canvas.width = 800;
    canvas.height = 600;
    const ctx = canvas.getContext("2d");

    obniz.onconnect = async () => {
      const cam = obniz.wired("ArduCAMMini", {
        cs: 0,
        mosi: 1,
        miso: 2,
        sclk: 3,
        gnd: 4,
        vcc: 5,
        sda: 6,
        scl: 7,
      });
      await cam.startupWait();

      // 定期的にカメラ画像を取得する
      while (true) {
        const data = await cam.takeWait("800x600");
        const base64 = cam.arrayToBase64(data);

        const img = new Image();
        img.src = "data:image/jpeg;base64, " + base64;
        img.onload = () => {
          ctx.drawImage(img, 0, 0);
          ctx.beginPath();
          ctx.rect(0, 90, 100, 100); // 左上
          ctx.rect(700, 90, 100, 100); // 右上
          ctx.rect(0, 480, 100, 100); // 左下
          ctx.rect(700, 480, 100, 100); // 右下
          ctx.strokeStyle = "white";
          ctx.lineWidth = 2;
          ctx.stroke();

          // 色識別結果を表示
          const upleft = ctx.getImageData(50, 140, 10, 10);
          const upright = ctx.getImageData(750, 140, 10, 10);
          const downleft = ctx.getImageData(50, 530, 10, 10);
          const downright = ctx.getImageData(750, 530, 10, 10);

          // 検出した色を元に画面上に名前を表示
          document.getElementById("upleft").textContent = ditectRecord(
            checkColor(upleft)[0],
            imageData
          )?.name;
          document.getElementById("upright").textContent = ditectRecord(
            checkColor(upright)[0],
            imageData
          )?.name;
          document.getElementById("downleft").textContent = ditectRecord(
            checkColor(downleft)[0],
            imageData
          )?.name;
          document.getElementById("downright").textContent = ditectRecord(
            checkColor(downright)[0],
            imageData
          )?.name;
        };
      }
    };
    // 画像上をクリックしたときの処理
    document.getElementById("TestCanvas").onclick = function (event) {
      const clickX = event.pageX;
      const clickY = event.pageY;
      const clientRect = this.getBoundingClientRect();
      const positionX = clientRect.left + window.pageXOffset;
      const positionY = clientRect.top + window.pageYOffset;

      const x = clickX - positionX;
      const y = clickY - positionY;

      const image = ctx.getImageData(x, y, 10, 10);
      const res = checkColor(image);
      if (!res[0]) return;

      console.log(`
              色識別結果
              【${res[0]}】
              RGB
              【${res[1]} ${res[2]} ${res[3]}】`);

      const target = ditectRecord(res[0], imageData);

      // クリックした部分の色を元にレコード情報を表示させる
      swal({
        text: `
            名前: ${target.name}
            会社名: ${target.company}
            役職: ${target.post}
          `,
        icon: target.imageUrl,
      });
    };
  });
})();
