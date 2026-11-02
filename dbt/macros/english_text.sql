{#
    Everything the site displays is meant to be English. Ported from the
    main project's Postgres macros to DuckDB: regexp_matches instead of ~,
    \b instead of \m and \M (RE2 has no \m), nfc_normalize instead of
    normalize(..., NFC).
#}

{% macro has_non_latin_script(column) %}
{#- True when the text has a letter outside the Latin script. Latin accents
    are allowed, so "Emily Brontë" and "Vālmīki" pass. -#}
    coalesce(regexp_matches({{ column }}, '[^\x00-\x7F\x{00A0}-\x{024F}\x{0300}-\x{036F}\x{1E00}-\x{1EFF}\x{2000}-\x{206F}]'), false)
{%- endmacro %}

{% macro latin_or_null(column) %}
    case when {{ has_non_latin_script(column) }} then null else {{ column }} end
{%- endmacro %}

{% macro is_non_english_subject(column) %}
{#- Open Library subject tags come from many national catalogues. Flags a
    tag in a non-Latin script, with French, Spanish, German or Polish
    accented letters, or with a common French, Spanish or German word. -#}
    (
        {{ has_non_latin_script(column) }}
        or regexp_matches(nfc_normalize({{ column }}), '[àâäçéèêëîïôöœùûüÿæáíóúãõąęłńźżßÀÂÄÇÉÈÊËÎÏÔÖŒÙÛÜÁÍÓÚÃÕĄĘŁŃŹŻ¿¡]')
        or regexp_matches(lower({{ column }}), '\b(et|du|des|les|pour|dans|aux|sur|und|der|das|para|con|del|romans|nouvelles|ouvrages|jeunesse|histoire|femmes|hommes|novela|novelas|ficcion|cuentos|lectures|morceaux|mythologie|psychologie|psychologues|psychohistoire|autriche|lieux|imaginaires|monde|literatura|horrorroman)\b')
    )
{%- endmacro %}
