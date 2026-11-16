# HitungSkorPadel

Papan skor padel di browser. Ketuk sisi yang menang poin, lalu game, set, tie-break, dan giliran servis dihitung sendiri.

## Menjalankan di komputer

```bash
npm install
npm run dev
```

Buka http://localhost:3000.

## Hosting gratis di Vercel

1. Buat akun di https://vercel.com
2. Dari folder proyek, jalankan `npx vercel`
3. Ikuti perintahnya. Vercel memberi alamat gratis, dan setiap perubahan yang di-deploy ikut terbarui.

Tidak perlu database untuk main sendiri. Skor yang sedang berjalan tetap tersimpan di perangkat.

## Akun Google dan tautan pertandingan

Situs tetap di Vercel. Firebase hanya menyimpan pertandingan yang dibagikan.

1. Buat proyek di https://console.firebase.google.com
2. Authentication → Sign-in method → aktifkan Google.
3. Firestore Database → buat database. Mode production, lalu tempel isi `firestore.rules`.
4. Project settings → Your apps → Web. Salin apiKey, authDomain, projectId, dan appId.
5. Authentication → Settings → Authorized domains: tambahkan `localhost` dan `hitungskorpadel.vercel.app`.
6. Salin `env.example` menjadi `.env.local` dan isi keempat nilai itu. File `.env.local` tidak ikut git.
7. Di Vercel, Project → Settings → Environment Variables, isi keempat variabel yang sama, lalu jalankan `npx vercel --prod --yes` dari folder ini.

Sebelum variabel itu diisi, tombol masuk tidak muncul dan permainan tetap tersimpan di perangkat. Setelah masuk, permainan di perangkat ini ikut naik ke akun. Orang lain membuka `https://hitungskorpadel.vercel.app/m/{id}` untuk melihat skor. Yang mengubah skor tetap akun pembuatnya.

Matikan Vercel Authentication di Project → Settings → Deployment Protection supaya orang lain bisa membuka tautannya.
