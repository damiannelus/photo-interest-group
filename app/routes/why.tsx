import { Link } from "react-router";

export default function WhyPage() {
  return (
    <div className="min-h-screen bg-bg-base px-6 py-10">
      <div className="mx-auto max-w-prose">
        <Link
          to="/"
          className="inline-block mb-8 text-sm text-text-secondary hover:text-text-primary transition-colors"
        >
          ← Back
        </Link>
        <div className="flex flex-col gap-4 text-text-secondary text-sm leading-relaxed">
          <p>
            Cześć. Zaprosiłem Cię tutaj, bo jesteś dla mnie ważną osobą,
            fotografem, a jednocześnie kimś, od kogo łatwo mi będzie przyjąć
            krytykę.
          </p>
          <p>
            Zbudowałem Photo Interest Group (🐷) z czystej frustracji.
            Złapałem się na tym, że wrzucając zdjęcia na Instagrama czy
            Facebooka, karmię tylko własną próżność. Czekam na losowe reakcje,
            a gdy ich nie ma – czuję zniechęcenie. Jednocześnie zniknęła
            bezpośrednia relacja i rozmowa o zdjęciach jako pracy na którą
            składają się konkretne narzędzia i środki. Sam uczyłem się nowych
            rzeczy, eksperymentowałem z kompozycją, kląłem przy postprocesie,
            a potem... traktowałem to jak zwykły, szybki content.
          </p>
          <p>
            Ta aplikacja działa na odwrót. Jest zamknięta grupa i bezpośrednia
            relacja. Jest jedna zasada: nie opublikujesz zdjęcia, dopóki nie
            napiszesz o nim minimum 50 znaków własnej refleksji. Co chciałeś
            osiągnąć? Co poszło nie tak? Co zrobiłbyś inaczej? Chcę tą blokadą
            celowo zrobić miejsce na zaangażowanie i krytyczne spojrzenie na
            własną pracę. Nie chcę letniości ani grzecznościowych komplementów.
            Stwórzmy przestrzeń, w której każde zdjęcie jest początkiem
            szczerej rozmowy, a nie kolejnym szybkim kliknięciem.
          </p>
          <p>Zapraszam!</p>
        </div>
      </div>
    </div>
  );
}
