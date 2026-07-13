// 製品情報の写真・動画保存先（tube-manual の server.js PHOTO_DIR と同一）
// tube-manual と並行稼働するため、保存先とURL形式 /uploads/<folder>/<file> を共有する。
export const PRODUCT_PHOTO_DIR =
  process.env.PRODUCT_PHOTO_DIR ||
  "\\\\Sv-04\\ﾃﾞｰﾀﾍﾞｰｽ\\製造グループ\\加工チーム\\SHOP3\\メンテナンスアプリ写真";
