"""
Exporta as metas da planilha mensal para o site (site/data.js).

Uso:
    python scripts/exportar_dados.py                      # usa a planilha padrão
    python scripts/exportar_dados.py "caminho/planilha.xlsx"

A planilha precisa ter as abas (o prefixo numérico é ignorado):
    - "Meta Mensal"         -> Nacional | Regional | Código | Loja | Meta mês | Meta calçados | ...
    - "diarizada_total"     -> Loja | Cod Loja | dia 1 ... dia 31 | Total
    - "diarizada_calcados", "diarizada_auto", "diarizada_bike", "diarizada_oms_2"
    - "Vendex" (opcional)   -> usada apenas para descobrir o mês/ano pelas datas do cabeçalho
"""

import calendar
import datetime as dt
import json
import sys
import unicodedata
from pathlib import Path

import openpyxl

RAIZ = Path(__file__).resolve().parent.parent
PLANILHA_PADRAO = RAIZ / "01. meta_Novembro_envio.xlsx"
SAIDA = RAIZ / "site" / "data.js"

# chave interna -> (sufixo da aba diarizada, coluna da Meta Mensal, rótulo)
SETORES = {
    "calcados": ("diarizada_calcados", "meta calcados", "Calçados"),
    "auto": ("diarizada_auto", "meta autosservico", "Autosserviço"),
    "bike": ("diarizada_bike", "meta bike", "Bike"),
    "oms": ("diarizada_oms", "meta oms", "OMS"),
}

MESES = ["", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho",
         "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"]


def norm(texto):
    """Minúsculas e sem acentos, para comparar cabeçalhos/nomes de abas."""
    texto = unicodedata.normalize("NFKD", str(texto or ""))
    return "".join(c for c in texto if not unicodedata.combining(c)).strip().lower()


def achar_aba(wb, sufixo):
    for ws in wb.worksheets:
        if sufixo in norm(ws.title):
            return ws
    return None


def num(valor):
    try:
        return round(float(valor), 2)
    except (TypeError, ValueError):
        return 0.0


def descobrir_mes(wb, caminho):
    aba = achar_aba(wb, "vendex")
    if aba is not None:
        for linha in aba.iter_rows(max_row=5, values_only=True):
            for valor in linha:
                if isinstance(valor, dt.datetime):
                    return valor.year, valor.month
    # fallback: nome do arquivo + ano atual
    nome = norm(Path(caminho).stem)
    for i, mes in enumerate(MESES[1:], start=1):
        if norm(mes) in nome:
            return dt.date.today().year, i
    hoje = dt.date.today()
    return hoje.year, hoje.month


def ler_meta_mensal(wb):
    aba = achar_aba(wb, "meta mensal")
    if aba is None:
        raise SystemExit("Aba 'Meta Mensal' não encontrada.")

    linhas = aba.iter_rows(max_col=20, values_only=True)
    cabecalho = None
    for linha in linhas:
        nomes = [norm(v) for v in linha]
        if "codigo" in nomes and "loja" in nomes:
            cabecalho = {nome: i for i, nome in enumerate(nomes) if nome}
            break
    if cabecalho is None:
        raise SystemExit("Cabeçalho da aba 'Meta Mensal' não encontrado.")

    lojas = {}
    for linha in linhas:
        codigo = linha[cabecalho["codigo"]]
        if codigo in (None, ""):
            continue
        try:
            codigo = int(codigo)
        except (TypeError, ValueError):
            continue
        regional_str = str(linha[cabecalho.get("regional", 0)] or "").strip()
        if "romulo" not in norm(regional_str):
            continue
        lojas[codigo] = {
            "codigo": codigo,
            "nome": str(linha[cabecalho["loja"]] or "").strip(),
            "nacional": str(linha[cabecalho.get("nacional", 0)] or "").strip(),
            "regional": regional_str,
            "meta": {
                "total": num(linha[cabecalho["meta mes"]]),
                **{k: num(linha[cabecalho[col]]) if col in cabecalho else 0.0
                   for k, (_, col, _) in SETORES.items()},
            },
            "diario": {},
        }
    return lojas


def ler_diarizada(wb, sufixo, dias_no_mes):
    aba = achar_aba(wb, sufixo)
    if aba is None:
        print(f"  aviso: aba '{sufixo}' não encontrada, usando zeros.")
        return {}

    linhas = aba.iter_rows(max_col=40, values_only=True)
    col_cod = col_dia1 = None
    for linha in linhas:
        nomes = [norm(v) for v in linha]
        if "cod loja" in nomes and "dia 1" in nomes:
            col_cod, col_dia1 = nomes.index("cod loja"), nomes.index("dia 1")
            break
    if col_cod is None:
        print(f"  aviso: cabeçalho da aba '{aba.title}' não encontrado.")
        return {}

    dados = {}
    for linha in linhas:
        try:
            codigo = int(linha[col_cod])
        except (TypeError, ValueError):
            continue
        dados[codigo] = [num(linha[col_dia1 + d]) for d in range(dias_no_mes)]
    return dados


def main():
    caminho = Path(sys.argv[1]) if len(sys.argv) > 1 else PLANILHA_PADRAO
    print(f"Lendo {caminho.name} ...")
    wb = openpyxl.load_workbook(caminho, read_only=True, data_only=True)

    ano, mes = descobrir_mes(wb, caminho)
    dias_no_mes = calendar.monthrange(ano, mes)[1]
    lojas = ler_meta_mensal(wb)

    diarios = {"total": ler_diarizada(wb, "diarizada_total", dias_no_mes)}
    for chave, (sufixo, _, _) in SETORES.items():
        diarios[chave] = ler_diarizada(wb, sufixo, dias_no_mes)

    for codigo, loja in lojas.items():
        for chave, dados in diarios.items():
            loja["diario"][chave] = dados.get(codigo, [0.0] * dias_no_mes)

    saida = {
        "ano": ano,
        "mes": mes,
        "mesNome": MESES[mes],
        "diasNoMes": dias_no_mes,
        "geradoEm": dt.datetime.now().isoformat(timespec="minutes"),
        "setores": {k: rotulo for k, (_, _, rotulo) in SETORES.items()},
        "lojas": sorted(lojas.values(), key=lambda l: l["codigo"]),
    }

    SAIDA.parent.mkdir(parents=True, exist_ok=True)
    SAIDA.write_text(
        "// Gerado automaticamente por scripts/exportar_dados.py — não editar à mão.\n"
        "window.METAS = " + json.dumps(saida, ensure_ascii=False, separators=(",", ":")) + ";\n",
        encoding="utf-8",
    )
    print(f"OK: {len(lojas)} lojas de {MESES[mes]}/{ano} exportadas para {SAIDA.relative_to(RAIZ)}")


if __name__ == "__main__":
    main()

