// Photos from the approved design (generated images, no real people). Files in /public/fotos.
export const photos = {
  abraco: { src: "/fotos/abraco.jpg", width: 896, height: 1088 },
  almoco: { src: "/fotos/almoco.jpg", width: 1344, height: 768 },
  filhaSorrindo: { src: "/fotos/filha-sorrindo.jpg", width: 1440, height: 704 },
  filha: { src: "/fotos/filha.jpg", width: 896, height: 1088 },
  fixo: { src: "/fotos/fixo.jpg", width: 896, height: 1088 },
  maos: { src: "/fotos/maos.jpg", width: 896, height: 1088 },
  pilLilas: { src: "/fotos/pil-lilas.jpg", width: 952, height: 952 },
  pilVerde: { src: "/fotos/pil-verde.jpg", width: 952, height: 952 },
  tomei: { src: "/fotos/tomei.jpg", width: 896, height: 1088 },
} as const;

export type PhotoName = keyof typeof photos;
