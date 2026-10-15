// Kalimat soal figural bersifat baku dan tidak boleh menyebut aturannya; aturan hanya muncul di pembahasan.
export const STEMS: Record<string, string[]> = {
  analogi: ['Tentukanlah gambar yang tepat untuk menggantikan tanda tanya "?", sehingga kedua pasangan gambar di bawah ini memiliki hubungan yang serupa.'],
  ketidaksamaan: ['Manakah gambar yang memiliki prinsip, pola, atau karakteristik yang berbeda dibandingkan gambar lainnya?'],
  serial: ['Tentukanlah gambar berikutnya dari seri gambar di bawah ini!', 'Tentukanlah gambar yang tepat untuk menggantikan tanda tanya "?" pada seri gambar di bawah ini!'],
  matriks: ['Tentukanlah gambar yang tepat untuk menggantikan tanda tanya "?" pada susunan gambar di bawah ini!'],
};
// Kata dan angka yang menandakan kalimat soal sudah membocorkan aturan.
export const LEAK = /rotasi|putar|cermin|searah|berlawanan|derajat|°|siklus|ganjil|genap|prima|\bjumlah\b|bertambah|berkurang|berubah|bergeser|berbalik|bergantian|warna|isi |urutan|hitam|putih|abu|\d/i;
