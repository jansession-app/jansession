# JanSession

JanSession coordina jam session reali: distingue una proposta dalla formazione completa, la conoscenza della struttura, la suonabilità e la scaletta ufficiale.

Progetto realizzato con il supporto di theLittle company.

È una SPA mobile-first in italiano costruita con React, TypeScript e Vite. Usa `HashRouter`, quindi gli inviti funzionano su hosting statico come `#/join/X7KD92` senza errori 404. L'architettura iniziale usa esclusivamente piani gratuiti: Supabase Free, GitHub Free e GitHub Pages.

## Avvio locale

Requisiti: Node.js 20+ e pnpm.

```bash
pnpm install
pnpm dev
```

Aprire l'indirizzo mostrato da Vite. Senza variabili Supabase, l'app entra automaticamente in modalità demo. I dati demo sono salvati in `localStorage` e possono essere ripristinati dal pulsante in alto a destra.

Comandi di verifica:

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

## Modalità demo

La demo include la jam “Jam Session Poggiardo”, cinque musicisti e cinque brani. Sono rappresentati tutti gli stati derivati:

- `INCOMPLETE`: almeno un posto strumentale obbligatorio è vuoto;
- `TO_PREPARE`: formazione completa, ma qualcuno non conosce ancora la struttura;
- `PLAYABLE`: tutti conoscono almeno la struttura;
- `READY`: tutti gli assegnati sono pronti.

Si possono creare jam e proposte, modificare quantità e ruoli, occupare/lasciare un posto compatibile, dichiararsi disponibili, aggiornare il proprio stato, gestire la scaletta e accettare inviti. Il brano demo “Everlong” resta in scaletta anche se incompleto per mostrare l'edge case richiesto.

## Collegare Supabase Free

1. Creare un progetto su [Supabase](https://supabase.com/) usando il piano Free.
2. Nel SQL Editor eseguire, nell'ordine, i file in `supabase/migrations/` oppure usare la Supabase CLI con `supabase db push`.
3. In Supabase aprire **Project Settings → API** (o **Connect → App Frameworks**, secondo l'interfaccia corrente) e copiare:
   - Project URL in `VITE_SUPABASE_URL`;
   - publishable key in `VITE_SUPABASE_PUBLISHABLE_KEY`.
4. Copiare `.env.example` in `.env.local` e compilare i valori. La chiave anon/publishable è progettata per il browser; non usare mai la `service_role` nel frontend.
5. In **Authentication → URL Configuration** impostare:
   - Site URL locale: `http://localhost:5173` durante lo sviluppo;
   - Redirect URL locale: `http://localhost:5173/**`;
   - Redirect Pages: `https://TUO_USERNAME.github.io/jansession/**`.
6. L'accesso email è già implementato tramite magic link. Per Google, creare credenziali OAuth gratuite in Google Cloud, abilitare il provider in **Authentication → Providers → Google** e usare come callback l'URL indicato da Supabase. Google resta opzionale.

Quando entrambe le variabili sono presenti, l'app passa dalla demo all'autenticazione e al repository Supabase, carica i dati protetti da RLS e si aggiorna in realtime per assegnazioni, preparazione, membri, brani e scaletta.

## Database e sicurezza

Le migrazioni creano:

- `profiles`, `instruments`, `profile_instruments`;
- `jams`, `jam_members`, `jam_invites`;
- `songs`, `song_role_slots`, `role_assignments`, `role_volunteers`;
- `song_preparation`, `setlist_items`;
- indici, vincoli, trigger profilo/jam, funzioni invito e riordino;
- policy RLS su ogni tabella, hardening dei privilegi e pubblicazione realtime selettiva.

Le migrazioni inizializzano soltanto il catalogo standard degli strumenti. I musicisti, le jam e i brani della modalità demo restano esclusivamente nel seed locale TypeScript e non vengono inseriti nel database Supabase.

Le decisioni di autorizzazione sono documentate in [docs/rls-decisions.md](docs/rls-decisions.md). Il client non salva uno stato brano ridondante: lo calcola da posti, assegnazioni e preparazione con la funzione riusabile testata in `src/domain/songStatus.ts`.

## Pubblicare gratuitamente su GitHub Pages

1. Creare un repository GitHub pubblico chiamato `jansession` e inviare questo progetto sul branch `main`.
2. Nel repository aprire **Settings → Pages** e in **Build and deployment → Source** scegliere **GitHub Actions**.
3. In **Settings → Secrets and variables → Actions → Variables** aggiungere `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`. Sono variabili browser pubbliche; la sicurezza resta affidata a RLS. Non inserire `service_role`.
4. Eseguire il workflow “Validate and deploy JanSession to GitHub Pages”, oppure fare push su `main`.

Il workflow installa con lockfile, esegue test e lint, compila TypeScript, costruisce con base `/jansession/` e pubblica `dist` su Pages. Non richiede GitHub Pro, un dominio personalizzato o altri servizi a pagamento.

Se il repository avrà un nome diverso, aggiornare `base` in `vite.config.ts`.

## Struttura

```text
src/
  auth/          autenticazione email/Google e ripristino inviti
  components/    shell, navigazione, card e stati
  data/          demo persistente, selettori e repository Supabase
  domain/        tipi, etichette e logica degli stati
  pages/         home, jam, brano, scaletta, musicisti, profilo e form
supabase/
  migrations/    schema, funzioni, RLS e realtime
.github/workflows/deploy-pages.yml
```

## Costo iniziale

Il progetto non dipende da API a pagamento, server proprietari, domini custom o hosting a consumo. Per l'MVP previsto, il costo iniziale resta €0 entro i limiti dei piani gratuiti di Supabase e GitHub.
