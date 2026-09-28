let customers = [];
let teller1Selesai = 0; // Menyimpan waktu kapan Teller 1 akan kosong
let teller2Selesai = 0; // Menyimpan waktu kapan Teller 2 akan kosong
let teller3Selesai = 0; // Menyimpan waktu kapan Teller 3 akan kosong
let isAnimating = false; // Mencegah klik berulang saat animasi berjalan

const MAKS_CUSTOMER_MASSAL = 100; // Batas jumlah customer per sekali isi massal
const KUNCI_KOLOM = ['id', 'iat', 'layanan', 'kedatangan', 'teller', 'mulai', 'selesai', 'antri', 'sistem', 'idle', 'bebas1', 'bebas2', 'bebas3'];
const ID_SEMUA_TOMBOL = ['btn-tambah', 'btn-reset', 'btn-auto', 'btn-bulk'];

// Fungsi untuk membuat jeda (delay)
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Bilangan bulat acak di antara min dan max (keduanya termasuk)
const acak = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

// Aktifkan / nonaktifkan semua tombol sekaligus
function setTombolAktif(aktif) {
    ID_SEMUA_TOMBOL.forEach(id => {
        document.getElementById(id).disabled = !aktif;
    });
}

// ============================================================
// LOGIKA UTAMA: hitung satu customer lalu simpan ke array.
// Dipakai bersama oleh mode satuan, isi otomatis, dan input massal.
// ============================================================
function hitungCustomer(iat, layanan) {
    let newCustomer = {};
    let index = customers.length;

    newCustomer.id = index + 1;
    newCustomer.iat = iat;
    newCustomer.layanan = layanan;

    // 1. Hitung Waktu Kedatangan
    if (index === 0) {
        newCustomer.kedatangan = newCustomer.iat;
    } else {
        let prevCustomer = customers[index - 1];
        newCustomer.kedatangan = prevCustomer.kedatangan + newCustomer.iat;
    }

    // 2. Tentukan Teller dan Hitung Waktu Mulai & Idle
    // Pilih teller dengan waktu selesai paling kecil (paling dulu kosong)
    let tellerTimes = [teller1Selesai, teller2Selesai, teller3Selesai];
    let minTime = Math.min(...tellerTimes);
    let tellerIndex = tellerTimes.indexOf(minTime); // 0‑based index
    newCustomer.teller = tellerIndex + 1;
    // Waktu mulai adalah nilai terbesar antara kedatangan dan waktu teller yang dipilih selesai
    newCustomer.mulai = Math.max(newCustomer.kedatangan, minTime);
    newCustomer.idle = newCustomer.mulai - minTime;
    newCustomer.selesai = newCustomer.mulai + newCustomer.layanan;
    // Update teller selesai waktu
    if (tellerIndex === 0) {
        teller1Selesai = newCustomer.selesai;
    } else if (tellerIndex === 1) {
        teller2Selesai = newCustomer.selesai;
    } else {
        teller3Selesai = newCustomer.selesai;
    }

    // 3. Hitung Waktu Antri dan Waktu di Sistem
    newCustomer.antri = newCustomer.mulai - newCustomer.kedatangan;
    newCustomer.sistem = newCustomer.layanan + newCustomer.antri;

    // 4. Kolom bantu: kapan tiap teller bebas SETELAH customer ini selesai diproses.
    // Nilai ini dipakai customer berikutnya untuk menentukan teller mana yang lebih dulu kosong.
    newCustomer.bebas1 = teller1Selesai;
    newCustomer.bebas2 = teller2Selesai;
    newCustomer.bebas3 = teller3Selesai;

    // Simpan ke array
    customers.push(newCustomer);
    return newCustomer;
}

// ============================================================
// MODE SATUAN (animasi kolom per kolom, seperti sebelumnya)
// ============================================================
document.getElementById('btn-tambah').addEventListener('click', async function() {
    if (isAnimating) return; // Cegah penambahan data jika animasi baris sebelumnya belum selesai

    const iatInput = parseInt(document.getElementById('iat').value) || 0;
    const layananInput = parseInt(document.getElementById('waktu-layanan').value) || 0;

    if (layananInput <= 0) {
        alert("Waktu layanan harus lebih dari 0!");
        return;
    }

    const newCustomer = hitungCustomer(iatInput, layananInput);

    // Panggil fungsi render dengan animasi (kecepatan tetap 400ms per kolom)
    await jalankanAntrean([newCustomer], 400);
});

// Render satu baris, kolom per kolom, dengan jeda antar kolom (ms)
async function renderRowAnimated(cust, jeda) {
    const tbody = document.querySelector('#tabel-simulasi tbody');
    const tr = document.createElement('tr');

    // Buat tag <td> kosong terlebih dahulu
    const cells = KUNCI_KOLOM.map(() => {
        const td = document.createElement('td');
        tr.appendChild(td);
        return td;
    });

    tbody.appendChild(tr);
    tr.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); // Ikuti baris terbaru

    // Isi tag <td> satu per satu dengan delay sesuai kecepatan (400ms = 0.4 detik)
    for (let i = 0; i < KUNCI_KOLOM.length; i++) {
        await sleep(jeda);
        cells[i].innerText = cust[KUNCI_KOLOM[i]]; // Masukkan data
        cells[i].classList.add('cell-filled'); // Berikan efek animasi CSS

        // Hapus class warna hijau setelah 1 detik agar kembali normal
        setTimeout(() => cells[i].classList.remove('cell-filled'), 1000);
    }
}

// Jalankan antrean: customer masuk ke tabel satu per satu, ada jeda antar customer.
// Tombol dikunci selama proses berjalan.
async function jalankanAntrean(daftar, jeda) {
    isAnimating = true;
    setTombolAktif(false);
    try {
        for (let i = 0; i < daftar.length; i++) {
            await renderRowAnimated(daftar[i], jeda);
            if (i < daftar.length - 1) await sleep(jeda); // Jeda sebelum customer berikutnya
        }
    } finally {
        setTombolAktif(true);
        isAnimating = false;
    }
}

// ============================================================
// MODE MASSAL: banyak customer sekaligus.
// Hasil hitung dibuat dulu semuanya, lalu ditampilkan sesuai pilihan kecepatan:
// berurutan satu per satu (ada jeda), atau instan.
// ============================================================
function tampilkanMassal(daftar) {
    const jeda = parseInt(document.getElementById('kecepatan').value);
    if (jeda > 0) {
        jalankanAntrean(daftar, jeda);
    } else {
        renderRowsMassal(daftar); // Instan: semua baris langsung muncul
    }
}

function renderRowsMassal(daftar) {
    const tbody = document.querySelector('#tabel-simulasi tbody');
    const fragment = document.createDocumentFragment();

    daftar.forEach((cust, i) => {
        const tr = document.createElement('tr');
        tr.classList.add('row-baru');
        tr.style.animationDelay = (i * 50) + 'ms'; // Baris muncul berurutan

        KUNCI_KOLOM.forEach(key => {
            const td = document.createElement('td');
            td.innerText = cust[key];
            tr.appendChild(td);
        });
        fragment.appendChild(tr);
    });

    tbody.appendChild(fragment);

    // Gulir ke baris terakhir agar hasil langsung terlihat
    const barisTerakhir = tbody.lastElementChild;
    if (barisTerakhir) barisTerakhir.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// Isi otomatis dengan nilai acak
document.getElementById('btn-auto').addEventListener('click', function() {
    if (isAnimating) return;

    const baca = (id) => parseInt(document.getElementById(id).value);
    const jumlah = baca('auto-jumlah');
    const iatMin = baca('auto-iat-min');
    const iatMax = baca('auto-iat-max');
    const layMin = baca('auto-layanan-min');
    const layMax = baca('auto-layanan-max');

    if ([jumlah, iatMin, iatMax, layMin, layMax].some(Number.isNaN)) {
        alert("Semua kolom isi otomatis harus diisi angka!");
        return;
    }
    if (jumlah < 1 || jumlah > MAKS_CUSTOMER_MASSAL) {
        alert("Jumlah customer harus antara 1 sampai " + MAKS_CUSTOMER_MASSAL + "!");
        return;
    }
    if (iatMin < 0 || iatMax < iatMin) {
        alert("Rentang IAT tidak valid. IAT minimum harus 0 atau lebih, dan tidak boleh lebih besar dari IAT maksimum.");
        return;
    }
    if (layMin < 1 || layMax < layMin) {
        alert("Rentang waktu layanan tidak valid. Layanan minimum harus 1 atau lebih, dan tidak boleh lebih besar dari layanan maksimum.");
        return;
    }

    const baru = [];
    for (let i = 0; i < jumlah; i++) {
        baru.push(hitungCustomer(acak(iatMin, iatMax), acak(layMin, layMax)));
    }
    tampilkanMassal(baru);
});

// Input massal manual: satu baris = "IAT, Waktu Layanan"
document.getElementById('btn-bulk').addEventListener('click', function() {
    if (isAnimating) return;

    const teks = document.getElementById('bulk-data').value;
    const baris = teks.split(/\r?\n/);
    const data = [];

    // Validasi semua baris dulu. Kalau ada yang salah, tidak ada yang ditambahkan.
    for (let i = 0; i < baris.length; i++) {
        const bersih = baris[i].trim();
        if (bersih === '') continue; // Lewati baris kosong

        const bagian = bersih.split(/[\s,;]+/);
        const iat = Number(bagian[0]);
        const layanan = Number(bagian[1]);

        if (bagian.length !== 2 || !Number.isInteger(iat) || !Number.isInteger(layanan)) {
            alert("Baris " + (i + 1) + " tidak valid: \"" + bersih + "\"\nGunakan format: IAT, Waktu Layanan (contoh: 2, 5)");
            return;
        }
        if (iat < 0) {
            alert("Baris " + (i + 1) + ": IAT tidak boleh negatif!");
            return;
        }
        if (layanan < 1) {
            alert("Baris " + (i + 1) + ": Waktu layanan harus lebih dari 0!");
            return;
        }
        data.push([iat, layanan]);
    }

    if (data.length === 0) {
        alert("Belum ada data. Isi minimal satu baris, contoh: 2, 5");
        return;
    }
    if (data.length > MAKS_CUSTOMER_MASSAL) {
        alert("Maksimal " + MAKS_CUSTOMER_MASSAL + " customer sekali input (sekarang " + data.length + ").");
        return;
    }

    const baru = data.map(([iat, layanan]) => hitungCustomer(iat, layanan));
    tampilkanMassal(baru);
    document.getElementById('bulk-data').value = ''; // Kosongkan kotak setelah berhasil
});

// ============================================================
// RESET
// ============================================================
document.getElementById('btn-reset').addEventListener('click', function() {
    customers = [];
    teller1Selesai = 0;
    teller2Selesai = 0;
    teller3Selesai = 0;
    document.querySelector('#tabel-simulasi tbody').innerHTML = ''; // Kosongkan tabel
});
