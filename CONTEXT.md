# VM Enhanced Pack — kontekst domenowy

## Słownik

### Pozycja zawodnika
Rola w drużynie w piłce siatkowej: `Atakujący`, `Libero`, `Przyjmujący`, `Rozgrywający`, `Środkowy`. W widokach VM może występować jako pełna nazwa lub skrót (`At`, `P`, `R`, `Śr`/`Sr`, `L`).

### Atrybut primary / secondary
Umiejętność ważna dla danej pozycji według `POSITION_RULES`:
- **primary** — kluczowe dla roli (wyższy priorytet treningu),
- **secondary** — uzupełniające.

Kolejność w regułach = kolejność priorytetu w kalkulatorze treningu juniorów.

### Umiejętność trenowalna (junior)
Atrybut z poziomem poniżej `30.5` (`MAX_JUNIOR_LEVEL`). Tylko takie wchodzą do auto-ładowania listy w kalkulatorze.

### Ładowanie umiejętności w kalkulatorze juniorów
Po wyborze zawodnika (lub wczytaniu kandydata scouta) lista umiejętności wypełnia się **automatycznie**: primary → secondary z reguł pozycji, wyłącznie trenowalne, tylko atrybuty obecne w `player.attributes`. Przycisk **„Wczytaj wszystkie”** ładuje pełną listę trenowalnych (posortowaną po poziomie) jako override.

Przy pustej liście (nieznana pozycja lub wszystkie rekomendowane na max): hint *„Nie udało się ustalić rekomendowanych umiejętności — użyj «Wczytaj wszystkie»"*.

### POSITION_RULES (wspólny moduł)
Reguły primary/secondary per pozycja żyją w `vm-position-rules.js` (`window.VMPositionRules`). Konsumowane przez: kalkulator treningu juniorów, profile enhancer, squad enhancer. Moduł zawiera też mapę skrótów pozycji (`At` → `Atakujący` itd.) i mapę etykiet atrybutów ↔ kody `UM_*`.
