# AI Game Master — Week 2 (Auth + Start Screen + Campaigns)

Gotowy kod na **Tydzień 2**:
- Logowanie / rejestracja przez **Supabase** (email + hasło)
- Ekran startowy: **Nowa kampania** / **Kontynuuj**
- **Lista kampanii** użytkownika, tworzenie nowej, wybór kampanii do kontynuacji
- Serwer Express (CJS) zostawiamy — endpoint `/health` i `/api/roll` jak wcześniej
- Odpowiedzi Mistrza Gry są czytane męskim głosem narratora (Web Speech API)

## Wymagania
- Node >= 20
- Konto w Supabase + projekt (URL + anon key)

## Szybki start
1) Zainstaluj paczki (w katalogu głównym repo):
```
npm i
```
2) Skopiuj `.env.example` → `.env` w `apps/client` i `apps/server`.
   - W `apps/client/.env` ustaw `VITE_SUPABASE_URL` oraz `VITE_SUPABASE_ANON_KEY` (z Supabase → Settings → API).
   - W `apps/server/.env` podaj `OPENAI_API_KEY` i opcjonalnie `OPENAI_MODEL`. W zmiennej `GM_RULES` wpisz zasady, których Mistrz Gry ma przestrzegać.
3) W Supabase → SQL Editor → wklej i odpal `supabase/schema.sql`.
4) Odpal w 2 terminalach:
```
npm run dev:server
npm run dev:client
```
5) Otwórz: http://localhost:5173
