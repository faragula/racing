# Mania2D

Jednoobrazovkový prototyp zaměřený na akceleraci, kontrolované klouzání a krátký drift. Defaultní režim je **daily závod**: každý UTC den jiná 6×6 mapa, společný leaderboard a výběr ducha.

## Spuštění

Otevřete `index.html` v moderním prohlížeči. Hra nemá žádné externí závislosti a funguje i přímo z disku.
Před vstupem do hry je nutný účet se jménem a heslem. Jméno má 3–16 znaků a může obsahovat jen malá písmena `a-z` a čísla `0-9`.

## Ovládání

- `WASD` nebo šipky: pohyb; protisměr brzdí aktuální setrvačnost
- `Space`: kontrolovaný drift a ostřejší srovnání směru
- `R`: restart tratě
- Gamepad: levý stick nebo D-pad pro pohyb, `A`/`B` nebo triggery pro brake

## Daily

- Mapa se skládá z UTC data, klouzání je zamčené na 260 %
- Seed se načítá z tabulky `daily_tracks`; pokud pro den chybí, první klient atomicky uloží automatický seed odvozený z data
- Lobby ukáže WR, tvoje PB, TOP 10 a výběr ducha: **WR / TY / OFF**, nebo **JET** u soupeře
- První pohyb spustí čas; během jízdy zůstane jen strip se soupeřem
- Po cíli uvidíš místo a deltu vs WR / duch
- **Včera** je archiv: můžeš jet a tahat duchy, časy se neukládají
- **Volná jízda** vrátí seed, slider klouzání a lokálního ducha bez boardu

### Plánování daily seedů

Budoucí trať lze připravit v Supabase SQL editoru:

```sql
insert into public.daily_tracks (race_date, seed, slip, track_version, source)
values ('2026-09-10', '6-6-specialrace', 260, 2, 'planned')
on conflict (race_date) do update
set seed = excluded.seed,
    slip = excluded.slip,
    track_version = excluded.track_version,
    source = 'planned';
```

Plánujte pouze budoucí UTC datum a používejte seed, který jste ověřili ve FREE PLAY. Seed po začátku dne neměňte: leaderboard je navázaný na konkrétní seed.

## Seed a grid (volná jízda)

- Do pole **SEED** vložte řetězec ve formátu `šířka-výška-seed`, například `6-6-6gh4df6h`
- Tlačítko **Generovat** vytvoří deterministickou trať zadaného gridu
- Stejný seed vždy vrátí stejnou skladbu tileů i stejný průjezd
- Grid může mít velikost od `3x3` až do `50x50`

Čas se spustí prvním pohybovým vstupem. Trať vede od start tileu k cílovému tileu.
Nejrychlejší dokončená jízda se automaticky uloží v prohlížeči zvlášť pro každý seed.

## Leaderboard

Statická hra může zůstat na GitHub Pages; účty, časy a duchy bere Supabase databáze. Účty jsou skutečně jen jméno a heslo — nepoužívají e-mailové ani telefonní přihlášení. Board je per daily seed (každý den jiný). U každého účtu na daném seedu zůstane jen nejrychlejší čas; pomalejší pokus databáze zahodí a lepší přepíše i ducha.

1. Vytvořte projekt na [Supabase](https://supabase.com)
2. V SQL editoru spusťte celý `leaderboard.sql`. Skript vytvoří také tabulku `daily_tracks` a RPC pro denní tratě.
3. Do `config.js` doplňte Project URL a anon public klíč z Settings → API.

Hesla se hashují pomocí bcrypt (`pgcrypto`) přímo v databázi a nikdy se neukládají čitelně. Prohlížeč si ponechá jen náhodný session token s platností 30 dní. Bez e-mailu není dostupná obnova zapomenutého hesla.
