# JanSession: decisioni Row Level Security

La UI non è un confine di sicurezza. Ogni tabella applicativa ha RLS attivo e le operazioni sensibili sono autorizzate nel database.

## Principi

- I profili sono visibili solo all'utente stesso e ai musicisti con cui condivide almeno una jam.
- Una jam privata o con link è leggibile dai suoi membri. Un link non rende pubbliche le tabelle: l'anteprima usa una funzione limitata che restituisce solo nome, data e luogo.
- L'accettazione di un invito passa da `accept_jam_invite`; il client non può attribuirsi ruoli elevati.
- Gli organizzatori e co-organizzatori sono riconosciuti dalla funzione privata `can_manage_jam`. Solo il creatore può eliminare la jam, promuovere co-organizzatori o gestire l'invito proprietario. Un co-organizzatore può rimuovere soltanto musicisti ordinari.
- I musicisti propongono brani solo quando `proposals_open` è vero. Possono modificare le proprie proposte; i manager possono correggerle.
- Un ruolo si assegna autonomamente solo se l'utente appartiene alla jam, le assegnazioni sono aperte e lo strumento è nel suo profilo. Anche le assegnazioni dei manager richiedono che il destinatario sia membro e abbia lo strumento compatibile. La chiave primaria su `slot_id` impedisce due assegnati nello stesso posto.
- Lo stato di preparazione può essere inserito, aggiornato o eliminato solo dal relativo utente mentre appartiene alla jam del brano.
- I volontari possono scrivere o rimuovere solo la propria disponibilità; la disponibilità non è un'assegnazione.
- Solo organizer/co-organizer possono modificare la scaletta. All'inserimento, `song_is_playable` verifica nel database ruoli coperti e preparazione minima `KNOWS_STRUCTURE`.
- La scaletta viene riordinata tramite RPC autorizzata e le posizioni vengono ricompattate automaticamente dopo una rimozione. Un brano già in scaletta non viene rimosso se in seguito perde un ruolo o una preparazione: l'interfaccia ricalcola lo stato e mostra l'avviso.
- Le colonne di identità e appartenenza (`jam_id`, `song_id`, `user_id`, proprietari) non sono aggiornabili dal ruolo `authenticated`; il client può modificare soltanto i campi previsti dal prodotto.

Le funzioni helper `security definer` risiedono nello schema non esposto `private`, hanno un `search_path` esplicito e restituiscono soltanto verifiche minimali, evitando ricorsioni tra policy. Nello schema `public` restano eseguibili soltanto le RPC necessarie al prodotto, con grant espliciti per `anon` o `authenticated`.
