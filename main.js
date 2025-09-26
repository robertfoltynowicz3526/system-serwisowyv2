import { db } from "./firebase-config.js";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  deleteDoc,
  updateDoc,
  getDoc,
  runTransaction,
  addDoc,
  setDoc,
} from "firebase/firestore";
import Papa from "papaparse";

initializeApp();

function initializeApp() {
  const STAWKI = {
    S: { nazwa: "Wyjazdowe", stawka: 45 },
    W: { nazwa: "Warsztat", stawka: 35 },
    G: { nazwa: "Gwarancja", stawka: 35 },
    Z: { nazwa: "Zbrojenie", stawka: 30 },
    P: { nazwa: "Poprawka", stawka: 0 },
  };
  let wszystkieZlecenia = [],
    wszystkieProdukty = [],
    wszystkiePrzejazdy = [],
    czesciDoZlecenia = [],
    wszystkieMaszyny = [],
    wszystkieKlienci = [],
    wszystkieWpisyKalendarza = [];
  const NISKI_STAN_MAGAZYNOWY = 5;
  let calendar;
  let edytowanyPrzejazdId = null;
  let stockChangeOperation = null;

  const miesiacSummaryInput = document.getElementById("miesiac-summary");
  const miesiacPrzejazdyInput = document.getElementById("miesiac-przejazdy");
  const zlecenieKlientSelect = document.getElementById(
    "zlecenie-klient-select"
  );
  const zlecenieMaszynaSelect = document.getElementById(
    "zlecenie-maszyna-select"
  );
  const kalendarzContainer = document.getElementById("kalendarz");
  const kalendarzModal = document.getElementById("kalendarz-modal");
  const kalendarzForm = document.getElementById("kalendarz-form");
  const kalendarzModalTitle = document.getElementById("kalendarz-modal-title");
  const kalendarzPodsumowanieDiv = document.getElementById(
    "kalendarz-podsumowanie"
  );
  const assignModal = document.getElementById("assign-zlecenie-modal");
  const assignForm = document.getElementById("assign-zlecenie-form");
  const klientForm = document.getElementById("klient-form");
  const listaKlientowUl = document.getElementById("lista-klientow");
  const maszynaKlientSelect = document.getElementById("maszyna-klient-select");
  const maszynaForm = document.getElementById("maszyna-form");
  const listaMaszynUl = document.getElementById("lista-maszyn");
  const przejazdForm = document.getElementById("przejazd-form");
  const listaPrzejazdowDiv = document.getElementById("lista-przejazdow");
  const zlecenieForm = document.getElementById("zlecenie-form");
  const aktywneZleceniaLista = document.getElementById(
    "aktywne-zlecenia-lista"
  );
  const ukonczoneZleceniaLista = document.getElementById(
    "ukonczone-zlecenia-lista"
  );
  const completeModal = document.getElementById("complete-zlecenie-modal");
  const completeModalForm = document.getElementById("complete-zlecenie-form");
  const closeModalButton = completeModal.querySelector(".close-button");
  const summaryContainer = document.getElementById("summary-container");
  const modalMagazynLista = document.getElementById("modal-magazyn-lista");
  const partsToRemoveList = document.getElementById("parts-to-remove-list");
  const magazynForm = document.getElementById("magazyn-form");
  const magazynLista = document.getElementById("magazyn-lista");
  const bulkAddForm = document.getElementById("bulk-add-form");
  const stockModal = document.getElementById("stock-change-modal");
  const stockModalForm = document.getElementById("stock-change-form");
  const stockModalCloseButton = stockModal.querySelector(".close-button");
  const addOilBtn = document.getElementById("add-oil-btn");
  const oilTypeSelect = document.getElementById("oil-type");
  const oilContainerSizeSelect = document.getElementById("oil-container-size");
  const converterLitryInput = document.getElementById("converter-litry");
  const converterSztukiInput = document.getElementById("converter-sztuki");
  const resultSztuki = document.getElementById("result-sztuki");
  const resultLitry = document.getElementById("result-litry");

  window.openTab = (evt, tabName) => {
    document
      .querySelectorAll(".tab-content")
      .forEach((tab) => (tab.style.display = "none"));
    document
      .querySelectorAll(".tab-button")
      .forEach((button) => button.classList.remove("active"));
    document.getElementById(tabName).style.display = "block";
    evt.currentTarget.classList.add("active");
  };
  const now = new Date();
  const month = (now.getMonth() + 1).toString().padStart(2, "0");
  const year = now.getFullYear();
  const currentMonth = `${year}-${month}`;
  if (miesiacSummaryInput) miesiacSummaryInput.value = currentMonth;
  if (miesiacPrzejazdyInput) miesiacPrzejazdyInput.value = currentMonth;
  document.querySelector(".tab-button").click();

  function inicjalizujKalendarz() {
    if (!kalendarzContainer) return;
    calendar = new FullCalendar.Calendar(kalendarzContainer, {
      initialView: "dayGridMonth",
      locale: "pl",
      headerToolbar: {
        left: "prev,next today",
        center: "title",
        right: "dayGridMonth",
      },
      eventContent: (arg) => {
        let eventEl = document.createElement("div");
        eventEl.innerHTML = `<div>${arg.event.title}</div>`;
        if (arg.event.extendedProps.notatka) {
          eventEl.innerHTML += ` <small title="${arg.event.extendedProps.notatka}">📝</small>`;
        }
        let actionsEl = document.createElement("div");
        actionsEl.classList.add("event-actions");
        actionsEl.innerHTML = `<button type="button" class="btn-edit event-edit-btn" data-date="${arg.event.startStr}">E</button><button type="button" class="btn-remove event-delete-btn" data-date="${arg.event.startStr}">X</button>`;
        eventEl.appendChild(actionsEl);
        return { domNodes: [eventEl] };
      },
      dateClick: (info) => otworzModalGodzin(info.dateStr),
      datesSet: (view) => {
        obliczSumeGodzinZKalendarza(
          view.view.currentStart,
          view.view.currentEnd
        );
      },
    });
    calendar.render();
    wyswietlWpisyKalendarza();
  }
  async function otworzModalGodzin(data) {
    kalendarzModalTitle.textContent = `Ewidencja Czasu - ${data}`;
    kalendarzForm.reset();
    document.getElementById("kalendarz-data").value = data;
    const docSnap = await getDoc(doc(db, "godziny_pracy", data));
    if (docSnap.exists()) {
      const dane = docSnap.data();
      kalendarzForm["godziny-pracy"].value = dane.praca || 0;
      kalendarzForm["godziny-fakturowane"].value = dane.fakturowane || 0;
      kalendarzForm["nadgodziny"].value = dane.nadgodziny || 0;
      kalendarzForm["kalendarz-notatka"].value = dane.notatka || "";
    }
    kalendarzModal.style.display = "block";
  }
  async function obslugaZapisuGodzin(event) {
    event.preventDefault();
    const data = kalendarzForm["kalendarz-data"].value;
    const dane = {
      praca: Number(kalendarzForm["godziny-pracy"].value) || 0,
      fakturowane: Number(kalendarzForm["godziny-fakturowane"].value) || 0,
      nadgodziny: Number(kalendarzForm["nadgodziny"].value) || 0,
      notatka: kalendarzForm["kalendarz-notatka"].value || "",
    };
    try {
      await setDoc(doc(db, "godziny_pracy", data), dane);
      kalendarzModal.style.display = "none";
    } catch (e) {
      console.error("Błąd zapisu godzin: ", e);
    }
  }
  function wyswietlWpisyKalendarza() {
    onSnapshot(collection(db, "godziny_pracy"), (snapshot) => {
      wszystkieWpisyKalendarza = [];
      const events = [];
      snapshot.forEach((doc) => {
        const dane = doc.data();
        const id = doc.id;
        wszystkieWpisyKalendarza.push({ id, ...dane });
        let title = "";
        if (dane.praca > 0) title += `P: ${dane.praca}h<br>`;
        if (dane.fakturowane > 0) title += `F: ${dane.fakturowane}h<br>`;
        if (dane.nadgodziny > 0) title += `N: ${dane.nadgodziny}h`;
        if (title) {
          events.push({
            id: id,
            title: title.trim(),
            start: id,
            allDay: true,
            classNames: ["fc-event-custom"],
            extendedProps: { notatka: dane.notatka },
          });
        }
      });
      if (calendar) {
        calendar.removeAllEvents();
        calendar.addEventSource(events);
        obliczSumeGodzinZKalendarza(
          calendar.view.currentStart,
          calendar.view.currentEnd
        );
      }
    });
  }
  function obliczSumeGodzinZKalendarza(start, end) {
    const wpisyZMiesiaca = wszystkieWpisyKalendarza.filter((wpis) => {
      const dataWpisu = new Date(wpis.id);
      return dataWpisu >= start && dataWpisu < end;
    });
    const sumy = wpisyZMiesiaca.reduce(
      (acc, wpis) => {
        acc.praca += wpis.praca || 0;
        acc.fakturowane += wpis.fakturowane || 0;
        acc.nadgodziny += wpis.nadgodziny || 0;
        return acc;
      },
      { praca: 0, fakturowane: 0, nadgodziny: 0 }
    );
    kalendarzPodsumowanieDiv.innerHTML = `<p>Praca w miesiącu: <strong>${sumy.praca.toFixed(
      1
    )} h</strong></p><p>Fakturowane: <strong>${sumy.fakturowane.toFixed(
      1
    )} h</strong></p><p>Nadgodziny: <strong>${sumy.nadgodziny.toFixed(
      1
    )} h</strong></p>`;
  }
  async function obslugaKalendarza(event) {
    const target = event.target;
    if (target.classList.contains("event-edit-btn")) {
      otworzModalGodzin(target.dataset.date);
    }
    if (target.classList.contains("event-delete-btn")) {
      const data = target.dataset.date;
      if (confirm(`Czy na pewno chcesz usunąć wpis z dnia ${data}?`)) {
        await deleteDoc(doc(db, "godziny_pracy", data));
      }
    }
  }

  function aktualizujPulpit() {
    const aktywneZlecenia = wszystkieZlecenia.filter(
      (z) => z.status === "aktywne" || z.status === "nieprzypisane"
    ).length;
    document.getElementById("db-aktywne-zlecenia").textContent =
      aktywneZlecenia;
    const podsumowanie = obliczPodsumowanieFinansowe(
      currentMonth,
      wszystkieZlecenia
    );
    document.getElementById(
      "db-przychod-brutto"
    ).textContent = `${podsumowanie.sumaBrutto.toFixed(2)} zł`;
    document.getElementById(
      "db-przychod-netto"
    ).textContent = `${podsumowanie.sumaNetto.toFixed(2)} zł`;
    const produktyNiskiStan = wszystkieProdukty.filter(
      (p) => p.ilosc <= NISKI_STAN_MAGAZYNOWY && p.ilosc > 0
    );
    document.getElementById("db-niski-stan").innerHTML =
      produktyNiskiStan.length > 0
        ? produktyNiskiStan
            .map((p) => `<li>${p.nazwa} (${p.ilosc} szt.)</li>`)
            .join("")
        : "<li>Brak</li>";
  }

  function obliczPodsumowanieFinansowe(wybranyMiesiac, zlecenia) {
    let sumaGodzin = 0,
      sumaBrutto = 0;
    if (!wybranyMiesiac || zlecenia.length === 0)
      return { sumaGodzin, sumaBrutto, sumaNetto: 0 };
    const zleceniaZMiesiaca = zlecenia.filter(
      (z) =>
        z.status === "ukończone" &&
        z.dataUkonczenia &&
        z.dataUkonczenia.startsWith(wybranyMiesiac)
    );
    zleceniaZMiesiaca.forEach((zlecenie) => {
      sumaGodzin += zlecenie.wyfakturowaneGodziny || 0;
      if (STAWKI[zlecenie.typZlecenia]) {
        sumaBrutto +=
          (zlecenie.wyfakturowaneGodziny || 0) *
          STAWKI[zlecenie.typZlecenia].stawka;
      }
    });
    const sumaNetto = sumaBrutto * 0.7;
    return { sumaGodzin, sumaBrutto, sumaNetto };
  }

  function eksportujDoCSV(dane, nazwaPliku) {
    if (dane.length === 0) {
      alert("Brak danych do wyeksportowania.");
      return;
    }
    const csv = Papa.unparse(dane);
    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = nazwaPliku;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  async function dodajKlienta(event) {
    event.preventDefault();
    const dane = {
      nazwa: klientForm["klient-nazwa"].value,
      nip: klientForm["klient-nip"].value || "---",
      adres: klientForm["klient-adres"].value || "---",
      telefon: klientForm["klient-telefon"].value || "---",
      createdAt: new Date(),
    };
    try {
      await addDoc(collection(db, "klienci"), dane);
      klientForm.reset();
    } catch (e) {
      console.error("Błąd dodawania klienta: ", e);
    }
  }
  function wyswietlKlientow() {
    onSnapshot(
      query(collection(db, "klienci"), orderBy("nazwa")),
      (snapshot) => {
        wszystkieKlienci = [];
        let klienciHtml = "",
          selectHtml = '<option value="">-- Wybierz klienta --</option>',
          selectZleceniaHtml =
            '<option value="">-- Wybierz klienta --</option><option value="szybkie-zlecenie">-- SZYBKIE ZLECENIE (bez klienta) --</option>';
        snapshot.forEach((doc) => {
          const klient = { id: doc.id, ...doc.data() };
          wszystkieKlienci.push(klient);
          klienciHtml += `<li data-id="${klient.id}"><span><strong>${klient.nazwa}</strong> (NIP: ${klient.nip})<br><small>${klient.adres} | ${klient.telefon}</small></span><div><button class="delete-btn">Usuń</button></div></li>`;
          selectHtml += `<option value="${klient.id}">${klient.nazwa}</option>`;
          selectZleceniaHtml += `<option value="${klient.id}">${klient.nazwa}</option>`;
        });
        listaKlientowUl.innerHTML = klienciHtml
          ? `<ul>${klienciHtml}</ul>`
          : "<p>Brak klientów w bazie.</p>";
        maszynaKlientSelect.innerHTML = selectHtml;
        zlecenieKlientSelect.innerHTML = selectZleceniaHtml;
        document.getElementById("assign-klient-select").innerHTML = selectHtml;
      }
    );
  }
  async function obslugaListyKlientow(event) {
    const li = event.target.closest("li");
    if (!li) return;
    if (event.target.classList.contains("delete-btn")) {
      if (
        confirm(
          "Usunięcie klienta usunie też wszystkie jego maszyny i zlecenia. Kontynuować?"
        )
      ) {
        await deleteDoc(doc(db, "klienci", li.dataset.id));
      }
    }
  }

  async function dodajMaszyne(event) {
    event.preventDefault();
    const wybranyKlientId = maszynaKlientSelect.value;
    if (!wybranyKlientId) {
      alert("Proszę wybrać klienta!");
      return;
    }
    const klient = wszystkieKlienci.find((k) => k.id === wybranyKlientId);
    const dane = {
      klientId: wybranyKlientId,
      klientNazwa: klient.nazwa,
      typMaszyny: maszynaForm["maszyna-typ"].value,
      model: maszynaForm["maszyna-model"].value,
      nrSeryjny: maszynaForm["maszyna-serial"].value || "---",
      rokProdukcji: Number(maszynaForm["maszyna-rok"].value) || null,
      motogodziny: Number(maszynaForm["maszyna-mth"].value) || 0,
      createdAt: new Date(),
    };
    try {
      await addDoc(collection(db, "maszyny"), dane);
      maszynaForm.reset();
    } catch (e) {
      console.error("Błąd dodawania maszyny: ", e);
    }
  }
  function wyswietlMaszyny() {
    onSnapshot(
      query(collection(db, "maszyny"), orderBy("klientNazwa")),
      (snapshot) => {
        wszystkieMaszyny = [];
        snapshot.forEach((doc) => {
          wszystkieMaszyny.push({ id: doc.id, ...doc.data() });
        });
        const pogrupowaneMaszyny = wszystkieMaszyny.reduce((acc, maszyna) => {
          (acc[maszyna.klientNazwa] = acc[maszyna.klientNazwa] || []).push(
            maszyna
          );
          return acc;
        }, {});
        let maszynyHtml = "";
        for (const klientNazwa in pogrupowaneMaszyny) {
          maszynyHtml += `<div class="client-group"><div class="client-header"><h4>${klientNazwa}</h4><span class="arrow">▶</span></div><ul class="machine-list">${pogrupowaneMaszyny[
            klientNazwa
          ]
            .map(
              (maszyna) =>
                `<li data-id="${maszyna.id}"><span>${maszyna.typMaszyny} ${maszyna.model} (S/N: ${maszyna.nrSeryjny})</span><div><button class="delete-btn">Usuń</button></div></li>`
            )
            .join("")}</ul></div>`;
        }
        listaMaszynUl.innerHTML = maszynyHtml || "<p>Brak maszyn w bazie.</p>";
        zlecenieKlientSelect.dispatchEvent(new Event("change"));
      }
    );
  }
  async function obslugaListyMaszyn(event) {
    const element = event.target;
    if (element.closest(".client-header")) {
      const header = element.closest(".client-header");
      header.classList.toggle("open");
      header.nextElementSibling.classList.toggle("open");
      return;
    }
    const li = element.closest("li");
    if (!li) return;
    if (element.classList.contains("delete-btn")) {
      if (confirm("Usunięcie maszyny usunie też jej zlecenia. Kontynuować?")) {
        await deleteDoc(doc(db, "maszyny", li.dataset.id));
      }
    }
  }

  async function dodajLubEdytujPrzejazd(event) {
    event.preventDefault();
    const dane = {
      data: przejazdForm.data.value,
      skad: przejazdForm.skad.value,
      dokad: przejazdForm.dokad.value,
      dystans: Number(przejazdForm.dystans.value),
    };
    try {
      if (edytowanyPrzejazdId) {
        await updateDoc(doc(db, "przejazdy", edytowanyPrzejazdId), dane);
        edytowanyPrzejazdId = null;
      } else {
        dane.createdAt = new Date();
        await addDoc(collection(db, "przejazdy"), dane);
      }
      przejazdForm.reset();
      przejazdForm.querySelector("button").textContent = "Zapisz Przejazd";
    } catch (e) {
      console.error("Błąd zapisu przejazdu: ", e);
    }
  }
  function wyswietlPrzejazdy() {
    onSnapshot(
      query(collection(db, "przejazdy"), orderBy("data", "desc")),
      (snapshot) => {
        wszystkiePrzejazdy = [];
        snapshot.forEach((doc) =>
          wszystkiePrzejazdy.push({ id: doc.id, ...doc.data() })
        );
        filtrujIwyswietlPrzejazdy();
      }
    );
  }
  function filtrujIwyswietlPrzejazdy() {
    const przefiltrowane = wszystkiePrzejazdy.filter(
      (p) => p.data && p.data.startsWith(miesiacPrzejazdyInput.value)
    );
    listaPrzejazdowDiv.innerHTML =
      przefiltrowane.length === 0
        ? "<p>Brak przejazdów w tym miesiącu.</p>"
        : `<ul>${przegiltrowane
            .map(
              (p) =>
                `<li data-id="${p.id}"><span><strong>${p.data}</strong>: ${p.skad} → ${p.dokad} (<strong>${p.dystans} km</strong>)</span><div><button class="edit-btn">Edytuj</button><button class="delete-btn">Usuń</button></div></li>`
            )
            .join("")}</ul>`;
  }
  async function obslugaListyPrzejazdow(event) {
    const li = event.target.closest("li");
    if (!li) return;
    const docId = li.dataset.id;
    if (event.target.classList.contains("delete-btn")) {
      if (confirm("Na pewno usunąć?")) {
        await deleteDoc(doc(db, "przejazdy", docId));
      }
    }
    if (event.target.classList.contains("edit-btn")) {
      const przejazd = wszystkiePrzejazdy.find((p) => p.id === docId);
      if (przejazd) {
        przejazdForm.data.value = przejazd.data;
        przejazdForm.skad.value = przejazd.skad;
        przejazdForm.dokad.value = przejazd.dokad;
        przejazdForm.dystans.value = przejazd.dystans;
        edytowanyPrzejazdId = docId;
        przejazdForm.querySelector("button").textContent =
          "Zaktualizuj Przejazd";
        window.scrollTo(0, 0);
      }
    }
  }

  function wyswietlZlecenia() {
    onSnapshot(
      query(collection(db, "zlecenia"), orderBy("createdAt", "desc")),
      (snapshot) => {
        let aktywneHtml = "",
          ukonczoneHtml = "";
        wszystkieZlecenia = [];
        snapshot.forEach((doc) => {
          const zlecenie = doc.data();
          zlecenie.id = doc.id;
          wszystkieZlecenia.push(zlecenie);
          if (
            zlecenie.status === "aktywne" ||
            zlecenie.status === "nieprzypisane"
          ) {
            const nazwa = zlecenie.klientNazwa
              ? `${zlecenie.klientNazwa} - ${zlecenie.typMaszyny} ${zlecenie.model}`
              : zlecenie.nrZlecenia;
            const przycisk =
              zlecenie.status === "nieprzypisane"
                ? `<button class="assign-btn btn-edit">Przypisz</button>`
                : `<button class="complete-btn">Zakończ</button>`;
            aktywneHtml += `<li data-id="${
              zlecenie.id
            }"><span><strong>${nazwa}</strong><br><em>${
              zlecenie.opis || ""
            }</em></span><div>${przycisk}<button class="delete-btn">Usuń</button></div></li>`;
          } else {
            const nazwaMaszyny = `${zlecenie.klientNazwa} - ${zlecenie.typMaszyny} ${zlecenie.model}`;
            const uzyteCzesciHtml =
              zlecenie.uzyteCzesci?.length > 0
                ? `<br><small>Użyto: ${zlecenie.uzyteCzesci
                    .map((c) => `${c.nazwa} (x${c.ilosc})`)
                    .join(", ")}</small>`
                : "";
            ukonczoneHtml += `<li data-id="${
              zlecenie.id
            }"><span><strong>${nazwaMaszyny}</strong> (Nr: ${
              zlecenie.nrZlecenia
            })<br><em>Ukończono (${
              zlecenie.dataUkonczenia || "b.d."
            })</em><br>Fakturowano: <strong>${
              zlecenie.wyfakturowaneGodziny || 0
            }h</strong> | Typ: <strong>${
              zlecenie.typZlecenia || "?"
            }</strong>${uzyteCzesciHtml}</span><div><button class="delete-btn">Usuń</button></div></li>`;
          }
        });
        aktywneZleceniaLista.innerHTML = aktywneHtml
          ? `<ul>${aktywneHtml}</ul>`
          : "<p>Brak aktywnych zleceň.</p>";
        ukonczoneZleceniaLista.innerHTML = ukonczoneHtml
          ? `<ul>${ukonczoneHtml}</ul>`
          : "<p>Brak ukończonych zleceň.</p>";
        obliczIPokazPodsumowanieFinansowe();
        aktualizujPulpit();
      }
    );
  }

  async function dodajZlecenie(event) {
    event.preventDefault();
    const wybranyKlientId = zlecenieKlientSelect.value;
    const wybranaMaszynaId = zlecenieMaszynaSelect.value;
    let dane;
    if (wybranyKlientId === "szybkie-zlecenie") {
      dane = {
        status: "nieprzypisane",
        nrZlecenia: zlecenieForm["nr-zlecenia"].value,
        opis: zlecenieForm["opis-usterki"].value,
        createdAt: new Date(),
      };
    } else if (wybranyKlientId && wybranaMaszynaId) {
      const maszyna = wszystkieMaszyny.find((m) => m.id === wybranaMaszynaId);
      dane = {
        maszynaId: wybranaMaszynaId,
        klientId: maszyna.klientId,
        klientNazwa: maszyna.klientNazwa,
        typMaszyny: maszyna.typMaszyny,
        model: maszyna.model,
        status: "aktywne",
        nrZlecenia: zlecenieForm["nr-zlecenia"].value,
        opis: zlecenieForm["opis-usterki"].value,
        motogodziny:
          Number(zlecenieForm.motogodziny.value) || maszyna.motogodziny,
        createdAt: new Date(),
      };
    } else {
      alert("Wybierz klienta i maszynę LUB opcję 'Szybkie Zlecenie'.");
      return;
    }
    try {
      await addDoc(collection(db, "zlecenia"), dane);
      if (dane.maszynaId && zlecenieForm.motogodziny.value) {
        await updateDoc(doc(db, "maszyny", dane.maszynaId), {
          motogodziny: dane.motogodziny,
        });
      }
      zlecenieForm.reset();
      zlecenieKlientSelect.value = "";
      zlecenieMaszynaSelect.innerHTML =
        '<option value="">-- Najpierw wybierz klienta --</option>';
      zlecenieMaszynaSelect.disabled = true;
    } catch (e) {
      console.error("Błąd dodawania zlecenia: ", e);
    }
  }

  function obliczIPokazPodsumowanieFinansowe() {
    const podsumowanie = obliczPodsumowanieFinansowe(
      miesiacSummaryInput.value,
      wszystkieZlecenia
    );
    summaryContainer.innerHTML = `<p>Suma godzin: <strong>${podsumowanie.sumaGodzin.toFixed(
      2
    )} h</strong></p><p>Wartość Brutto: <strong>${podsumowanie.sumaBrutto.toFixed(
      2
    )} zł</strong></p><p>Wartość Netto (po 30%): <strong>${podsumowanie.sumaNetto.toFixed(
      2
    )} zł</strong></p>`;
  }

  async function obslugaListyZlecen(event) {
    const li = event.target.closest("li");
    if (!li) return;
    const docId = li.dataset.id;
    if (event.target.classList.contains("delete-btn")) {
      if (confirm("Na pewno usunąć?")) {
        await deleteDoc(doc(db, "zlecenia", docId));
      }
    }
    if (event.target.classList.contains("assign-btn")) {
      const zlecenie = wszystkieZlecenia.find((z) => z.id === docId);
      if (zlecenie) {
        document.getElementById("assign-zlecenie-id").value = docId;
        document.getElementById("assign-zlecenie-opis").textContent =
          zlecenie.nrZlecenia;
        document.getElementById("assign-machine-section").style.display =
          "none";
        assignForm.reset();
        assignModal.style.display = "block";
      }
    }
    if (event.target.classList.contains("complete-btn")) {
      const docSnap = await getDoc(doc(db, "zlecenia", docId));
      if (docSnap.exists()) {
        const zlecenie = docSnap.data();
        document.getElementById(
          "modal-klient"
        ).textContent = `${zlecenie.klientNazwa} - ${zlecenie.typMaszyny} ${zlecenie.model}`;
        document.getElementById("modal-nr-zlecenia").textContent =
          zlecenie.nrZlecenia;
        document.getElementById("complete-zlecenie-id").value = docId;
        czesciDoZlecenia = [];
        renderCzesciDoZlecenia();
        renderMagazynWModalu();
        completeModal.style.display = "block";
      }
    }
  }

  async function zapiszPrzypisanie(event) {
    event.preventDefault();
    const zlecenieId = assignForm["assign-zlecenie-id"].value;
    let klientId = assignForm["assign-klient-select"].value;
    let maszynaId = assignForm["assign-maszyna-select"].value;
    const nowyKlientNazwa = assignForm["assign-nowy-klient"].value.trim();
    const nowaMaszynaTyp = assignForm["assign-nowa-maszyna-typ"].value;
    const nowaMaszynaModel =
      assignForm["assign-nowa-maszyna-model"].value.trim();
    try {
      if (!klientId && nowyKlientNazwa) {
        const nowyKlientDoc = await addDoc(collection(db, "klienci"), {
          nazwa: nowyKlientNazwa,
          createdAt: new Date(),
        });
        klientId = nowyKlientDoc.id;
      }
      if (!klientId) {
        alert("Musisz wybrać lub dodać klienta.");
        return;
      }
      if (!maszynaId && nowaMaszynaModel && nowaMaszynaTyp) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        const klient = wszystkieKlienci.find((k) => k.id === klientId);
        const nowaMaszynaDoc = await addDoc(collection(db, "maszyny"), {
          klientId: klientId,
          klientNazwa: klient.nazwa,
          typMaszyny: nowaMaszynaTyp,
          model: nowaMaszynaModel,
          createdAt: new Date(),
        });
        maszynaId = nowaMaszynaDoc.id;
      }
      if (!maszynaId) {
        alert("Musisz wybrać lub dodać maszynę.");
        return;
      }
      setTimeout(async () => {
        const maszyna = wszystkieMaszyny.find((m) => m.id === maszynaId);
        if (!maszyna) {
          alert("Błąd: Nie znaleziono danych maszyny. Spróbuj ponownie.");
          return;
        }
        const daneDoAktualizacji = {
          maszynaId: maszynaId,
          klientId: maszyna.klientId,
          klientNazwa: maszyna.klientNazwa,
          typMaszyny: maszyna.typMaszyny,
          model: maszyna.model,
          status: "aktywne",
        };
        await updateDoc(doc(db, "zlecenia", zlecenieId), daneDoAktualizacji);
        assignModal.style.display = "none";
      }, 700);
    } catch (error) {
      console.error("Błąd podczas przypisywania:", error);
    }
  }

  function renderMagazynWModalu() {
    /* ... bez zmian ... */
  }
  function dodajCzescDoZlecenia(event) {
    /* ... bez zmian ... */
  }
  function renderCzesciDoZlecenia() {
    /* ... bez zmian ... */
  }
  async function obslugaListyCzesci(event) {
    /* ... bez zmian ... */
  }
  async function obslugaZakonczeniaZlecenia(event) {
    /* ... bez zmian ... */
  }

  // --- MAGAZYN ---
  // ... cały kod magazynu bez zmian

  // --- PODPIĘCIE EVENTÓW ---
  klientForm.addEventListener("submit", dodajKlienta);
  listaKlientowUl.addEventListener("click", obslugaListyKlientow);
  maszynaForm.addEventListener("submit", dodajMaszyne);
  listaMaszynUl.addEventListener("click", obslugaListyMaszyn);
  przejazdForm.addEventListener("submit", dodajLubEdytujPrzejazd);
  listaPrzejazdowDiv.addEventListener("click", obslugaListyPrzejazdow);
  miesiacPrzejazdyInput.addEventListener("change", filtrujIwyswietlPrzejazdy);
  document
    .getElementById("export-przejazdy-btn")
    .addEventListener("click", () => {
      /* ... */
    });
  zlecenieForm.addEventListener("submit", dodajZlecenie);
  aktywneZleceniaLista.addEventListener("click", obslugaListyZlecen);
  ukonczoneZleceniaLista.addEventListener("click", obslugaListyZlecen);
  completeModalForm.addEventListener("submit", obslugaZakonczeniaZlecenia);
  closeModalButton.onclick = () => {
    completeModal.style.display = "none";
  };
  miesiacSummaryInput.addEventListener("change", () => {
    obliczIPokazPodsumowanieFinansowe();
    aktualizujPulpit();
  });
  document
    .getElementById("export-zlecenia-btn")
    .addEventListener("click", () => {
      /* ... */
    });
  partsToRemoveList.addEventListener("click", obslugaListyCzesci);
  kalendarzForm.addEventListener("submit", obslugaZapisuGodzin);
  kalendarzContainer.addEventListener("click", obslugaKalendarza);
  kalendarzModal.querySelector(".close-button").onclick = () => {
    kalendarzModal.style.display = "none";
  };
  assignForm.addEventListener("submit", zapiszPrzypisanie);
  assignModal.querySelector(".close-button").onclick = () => {
    assignModal.style.display = "none";
  };
  document
    .getElementById("assign-klient-select")
    .addEventListener("change", (event) => {
      /* ... */
    });

  zlecenieKlientSelect.addEventListener("change", (event) => {
    const wybranyKlientId = event.target.value;
    if (wybranyKlientId === "szybkie-zlecenie" || !wybranyKlientId) {
      zlecenieMaszynaSelect.disabled = true;
      zlecenieMaszynaSelect.innerHTML = `<option value="">${
        wybranyKlientId ? "-- N/A --" : "-- Najpierw wybierz klienta --"
      }</option>`;
    } else {
      const maszynyKlienta = wszystkieMaszyny.filter(
        (m) => m.klientId === wybranyKlientId
      );
      let maszynySelectHtml = '<option value="">-- Wybierz maszynę --</option>';
      if (maszynyKlienta.length > 0) {
        maszynySelectHtml += maszynyKlienta
          .map(
            (m) => `<option value="${m.id}">${m.typMaszyny} ${m.model}</option>`
          )
          .join("");
        zlecenieMaszynaSelect.disabled = false;
      } else {
        maszynySelectHtml =
          '<option value="">-- Ten klient nie ma maszyn --</option>';
        zlecenieMaszynaSelect.disabled = true;
      }
      zlecenieMaszynaSelect.innerHTML = maszynySelectHtml;
    }
  });

  // ... i reszta listenerów dla magazynu ...

  // --- INICJALIZACJA ---
  inicjalizujKalendarz();
  wyswietlKlientow();
  wyswietlMaszyny();
  wyswietlPrzejazdy();
  wyswietlZlecenia();
  wyswietlMagazyn();
}
