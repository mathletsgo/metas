(() => {
  "use strict";

  const DADOS = window.METAS;
  const CHAVE_SESSAO = "metaLojas.sessao";
  const CHAVE_NOME = "metaLojas.nome";
  const DURACAO_BOAS_VINDAS = 3400; // ms
  const NOME_REGIONAL_FIXA = "Águia do Cerrado • Romulo Farias";

  // Filtra apenas lojas da Regional Águia do Cerrado (Romulo Farias)
  if (DADOS && Array.isArray(DADOS.lojas)) {
    DADOS.lojas = DADOS.lojas.filter((l) => {
      const reg = (l.regional || "").toLowerCase();
      const nac = (l.nacional || "").toLowerCase();
      return reg.includes("romulo") || reg.includes("rômulo") || reg.includes("cerrado") || nac.includes("cerrado");
    });
  }

  const SETOR_INFO = {
    total:    { rotulo: "Geral Loja",   sigla: "TOT", cor: "#e11d2e" },
    calcados: { rotulo: "Calçados",     sigla: "CAL", cor: "#ef4444" },
    auto:     { rotulo: "Autosserviço", sigla: "AUT", cor: "#10b981" },
    bike:     { rotulo: "Bike",         sigla: "BIK", cor: "#f59e0b" },
    oms:      { rotulo: "OMS Digital",  sigla: "OMS", cor: "#06b6d4" },
  };
  const SEMANA = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

  const $ = (id) => document.getElementById(id);
  const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
  const brlCompacto = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", notation: "compact", maximumFractionDigits: 1 });
  const pct = (v) => `${(v * 100).toFixed(1).replace(".", ",")}%`;

  let lojaAtual = null;
  let setorCalendario = "total";
  let diaSelecionado = 1;

  // ---------------- navegação ----------------
  function mostrarTela(id) {
    document.querySelectorAll(".tela").forEach((t) => t.classList.toggle("ativa", t.id === id));
    window.scrollTo(0, 0);
  }

  const rotuloLoja = (l) => l.nome || `Loja ${l.codigo}`;

  function acharLoja(texto) {
    const t = texto.trim().toLowerCase();
    if (!t) return null;
    return (
      DADOS.lojas.find((l) => rotuloLoja(l).toLowerCase() === t) ||
      DADOS.lojas.find((l) => String(l.codigo) === t.replace(/^0+/, "")) ||
      null
    );
  }

  // ---------------- login ----------------
  function iniciarLogin() {
    $("lista-lojas").innerHTML = DADOS.lojas
      .map((l) => `<option value="${rotuloLoja(l).replace(/"/g, "&quot;")}"></option>`)
      .join("");

    $("seletor-loja-topo").innerHTML = DADOS.lojas
      .map((l) => `<option value="${l.codigo}">${rotuloLoja(l)}</option>`)
      .join("");

    $("seletor-loja-topo").addEventListener("change", (e) => {
      const novoCodigo = Number(e.target.value);
      const novaLoja = DADOS.lojas.find((l) => l.codigo === novoCodigo);
      if (!novaLoja) return;
      lojaAtual = novaLoja;
      const nomeSalvo = localStorage.getItem(CHAVE_NOME) || $("topo-ola").textContent || "Visitante";
      const sessao = { codigo: novaLoja.codigo, nome: nomeSalvo };
      localStorage.setItem(CHAVE_SESSAO, JSON.stringify(sessao));
      montarDashboard(sessao);
    });

    const nomeSalvo = localStorage.getItem(CHAVE_NOME);
    if (nomeSalvo) $("campo-nome").value = nomeSalvo;

    $("form-login").addEventListener("submit", (e) => {
      e.preventDefault();
      const loja = acharLoja($("campo-loja").value);
      const nome = $("campo-nome").value.trim();
      const erro = $("erro-login");

      if (!loja) {
        erro.textContent = "Loja não encontrada. Escolha uma opção da lista.";
        erro.hidden = false;
        return;
      }
      if (!nome) {
        erro.textContent = "Informe seu nome.";
        erro.hidden = false;
        return;
      }
      erro.hidden = true;
      const nomeFormatado = capitalizar(nome);
      const sessao = { codigo: loja.codigo, nome: nomeFormatado };
      localStorage.setItem(CHAVE_NOME, nomeFormatado);
      localStorage.setItem(CHAVE_SESSAO, JSON.stringify(sessao));
      entrar(sessao);
    });

    $("btn-sair").addEventListener("click", () => {
      localStorage.removeItem(CHAVE_SESSAO);
      $("campo-nome").value = localStorage.getItem(CHAVE_NOME) || "";
      $("campo-loja").value = "";
      mostrarTela("tela-login");
      $("campo-loja").focus();
    });
  }

  const capitalizar = (s) => s.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());

  function entrar(sessao) {
    lojaAtual = DADOS.lojas.find((l) => l.codigo === sessao.codigo);
    if (!lojaAtual) {
      localStorage.removeItem(CHAVE_SESSAO);
      mostrarTela("tela-login");
      return;
    }

    const maiorDia = rankDias("total")[0];
    $("boas-vindas-nome").textContent = sessao.nome.split(" ")[0].toUpperCase();
    $("boas-vindas-loja").textContent = rotuloLoja(lojaAtual);
    $("boas-vindas-regional").textContent = `Regional ${NOME_REGIONAL_FIXA}`;
    $("boas-vindas-meta").textContent = brl.format(lojaAtual.meta.total);
    $("boas-vindas-pico").textContent = maiorDia
      ? `Pico Black Friday: Dia ${String(maiorDia.dia).padStart(2, "0")}/${String(DADOS.mes).padStart(2, "0")} (${brlCompacto.format(maiorDia.valor)})`
      : "";

    const chips = document.querySelectorAll(".bf-chip-setor");
    chips.forEach((c) => c.classList.remove("ativo"));

    const etapas = [
      { t: 0,    msg: "AQUECENDO A PISTA..." },
      { t: 0.25, msg: "ESCALANDO SETORES DA LOJA..." },
      { t: 0.55, msg: "CALIBRANDO METAS BLACK FRIDAY..." },
      { t: 0.85, msg: "SINAL VERDE • VAI PRO JOGO!" },
    ];

    mostrarTela("tela-carregando");

    const inicio = performance.now();
    function animarProgresso(agora) {
      const p = Math.min((agora - inicio) / (DURACAO_BOAS_VINDAS - 250), 1);
      $("carregando-pct").textContent = `${Math.round(p * 100)}%`;

      const etapaAtual = [...etapas].reverse().find((e) => p >= e.t);
      if (etapaAtual) $("carregando-status").textContent = etapaAtual.msg;

      chips.forEach((chip, idx) => {
        if (p >= (idx + 1) * 0.2) chip.classList.add("ativo");
      });

      if (p < 1) requestAnimationFrame(animarProgresso);
    }
    requestAnimationFrame(animarProgresso);

    setTimeout(() => {
      montarDashboard(sessao);
      mostrarTela("tela-dashboard");
    }, DURACAO_BOAS_VINDAS);
  }

  // ---------------- dashboard ----------------
  function diaDeHoje() {
    const hoje = new Date();
    return hoje.getFullYear() === DADOS.ano && hoje.getMonth() + 1 === DADOS.mes ? hoje.getDate() : null;
  }

  function renderSetoresDia(dia) {
    if (!dia || dia > DADOS.diasNoMes) {
      return '<p class="sub">Final do período mensal atingido.</p>';
    }
    const totalDia = lojaAtual.diario.total[dia - 1] || 1;
    return Object.keys(DADOS.setores)
      .map((k) => {
        const info = SETOR_INFO[k];
        const val = lojaAtual.diario[k][dia - 1] || 0;
        const p = totalDia > 0 ? val / totalDia : 0;
        const semMeta = lojaAtual.meta[k] <= 0 && val <= 0;
        return `
          <div class="hero-setor-item ${semMeta ? "vazio" : ""}" style="--cor-setor:${info.cor}">
            <div class="hero-setor-topo">
              <span class="hero-setor-sigla" style="color:${info.cor};border-color:${info.cor}44;background:${info.cor}14">${info.sigla}</span>
              <span class="hero-setor-nome">${info.rotulo}</span>
              <span class="hero-setor-pct mono">${val ? pct(p) : "—"}</span>
            </div>
            <strong class="hero-setor-valor mono">${val ? brl.format(val) : "Sem meta"}</strong>
          </div>`;
      })
      .join("");
  }

  function montarDashboard(sessao) {
    const l = lojaAtual;
    const hoje = diaDeHoje();
    const diaBase = hoje || 1;
    const proxDia = diaBase < DADOS.diasNoMes ? diaBase + 1 : null;
    const mesStr = String(DADOS.mes).padStart(2, "0");

    $("topo-ola").textContent = sessao.nome;
    $("topo-loja").textContent = rotuloLoja(l);
    $("seletor-loja-topo").value = String(l.codigo);
    $("mes-nome").textContent = `${DADOS.mesNome} ${DADOS.ano}`;
    $("meta-mes").textContent = brl.format(l.meta.total);
    $("meta-regional").textContent = [l.nacional, `Regional ${NOME_REGIONAL_FIXA}`].filter(Boolean).join("  •  ");

    const valorHoje = l.diario.total[diaBase - 1] || 0;
    const dataBase = new Date(DADOS.ano, DADOS.mes - 1, diaBase);
    const diaBaseFmt = `${String(diaBase).padStart(2, "0")}/${mesStr}`;

    $("rotulo-hoje").textContent = hoje ? `Meta de hoje (${diaBaseFmt})` : `Meta Dia ${diaBaseFmt}`;
    $("meta-hoje").textContent = brl.format(valorHoje);
    $("sub-hoje").textContent = `${SEMANA[dataBase.getDay()]} • ${pct(valorHoje / (l.meta.total || 1))} da meta do mês`;

    if (proxDia) {
      const valorAmanha = l.diario.total[proxDia - 1] || 0;
      const dataProx = new Date(DADOS.ano, DADOS.mes - 1, proxDia);
      const proxDiaFmt = `${String(proxDia).padStart(2, "0")}/${mesStr}`;
      const diff = valorHoje > 0 ? (valorAmanha - valorHoje) / valorHoje : 0;
      const sinal = diff >= 0 ? `▲ +${(diff * 100).toFixed(1).replace(".", ",")}%` : `▼ ${(diff * 100).toFixed(1).replace(".", ",")}%`;

      $("rotulo-amanha").textContent = `Prévia amanhã (${proxDiaFmt})`;
      $("meta-amanha").textContent = brl.format(valorAmanha);
      $("sub-amanha").textContent = `${SEMANA[dataProx.getDay()]} • ${sinal} vs hoje`;
      $("titulo-setores-amanha").textContent = `PRÉVIA DE AMANHÃ POR SETOR • ${proxDiaFmt} (${SEMANA[dataProx.getDay()].toUpperCase()})`;
    } else {
      $("rotulo-amanha").textContent = "Próximo dia";
      $("meta-amanha").textContent = "Fim do mês";
      $("sub-amanha").textContent = "Último dia do calendário mensal";
      $("titulo-setores-amanha").textContent = "PRÉVIA DO PRÓXIMO DIA";
    }

    $("titulo-setores-hoje").textContent = `META DE HOJE POR SETOR • ${diaBaseFmt} (${SEMANA[dataBase.getDay()].toUpperCase()})`;
    $("hero-setores-hoje").innerHTML = renderSetoresDia(diaBase);
    $("hero-setores-amanha").innerHTML = renderSetoresDia(proxDia);

    if (hoje) {
      $("dias-restantes").textContent = `${DADOS.diasNoMes - hoje + 1} de ${DADOS.diasNoMes}`;
      $("sub-periodo").textContent = `Dia ${diaBase} em andamento`;
    } else {
      $("dias-restantes").textContent = `${DADOS.diasNoMes} dias`;
      $("sub-periodo").textContent = `Calendário completo de ${DADOS.mesNome}`;
    }

    montarSetores();
    montarAbas();
    setorCalendario = "total";
    diaSelecionado = hoje || rankDias("total")[0].dia;
    montarCalendario();
    montarTopDias();

    const gerado = new Date(DADOS.geradoEm);
    $("rodape").textContent = `Dados atualizados em ${gerado.toLocaleDateString("pt-BR")} às ${gerado.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
  }

  function montarSetores() {
    const total = lojaAtual.meta.total || 1;
    $("setores").innerHTML = Object.keys(DADOS.setores)
      .map((k) => {
        const info = SETOR_INFO[k];
        const v = lojaAtual.meta[k] || 0;
        const p = v / total;
        return `
          <article class="card setor ${v ? "" : "vazio"}" style="--cor-setor:${info.cor}" data-setor="${k}">
            <div class="setor-topo">
              <span class="setor-tag" style="color:${info.cor};border-color:${info.cor}44;background:${info.cor}14">${info.sigla}</span>
              <span class="setor-share">${v ? pct(p) : "0,0%"}</span>
            </div>
            <h3>${info.rotulo}</h3>
            <p class="valor">${v ? brl.format(v) : "Sem meta"}</p>
            <p class="pct">${v ? "Participação na meta mensal" : "Sem meta alocada no período"}</p>
            <div class="barrinha"><div style="width:${(p * 100).toFixed(1)}%;background:${info.cor}"></div></div>
          </article>`;
      })
      .join("");

    $("setores").onclick = (e) => {
      const card = e.target.closest(".setor[data-setor]:not(.vazio)");
      if (!card) return;
      const k = card.dataset.setor;
      const btn = document.querySelector(`.aba[data-setor="${k}"]`);
      if (btn) {
        btn.click();
        document.querySelector(".calendario-card").scrollIntoView({ behavior: "smooth", block: "center" });
      }
    };
  }

  function montarAbas() {
    const abas = ["total", ...Object.keys(DADOS.setores).filter((k) => lojaAtual.meta[k] > 0)];
    $("abas-calendario").innerHTML = abas
      .map((k) => `<button class="aba ${k === "total" ? "ativa" : ""}" data-setor="${k}"><span class="aba-dot" style="background:${SETOR_INFO[k].cor}"></span>${SETOR_INFO[k].rotulo}</button>`)
      .join("");
    $("abas-calendario").onclick = (e) => {
      const btn = e.target.closest(".aba");
      if (!btn) return;
      setorCalendario = btn.dataset.setor;
      document.querySelectorAll(".aba").forEach((b) => b.classList.toggle("ativa", b === btn));
      montarCalendario();
      montarTopDias();
    };
  }

  /** Dias ordenados do maior para o menor valor no setor informado. */
  function rankDias(setor) {
    return lojaAtual.diario[setor]
      .map((valor, i) => ({ dia: i + 1, valor }))
      .sort((a, b) => b.valor - a.valor);
  }

  /** Cor do "termômetro" Black-on-Black: preto carbono/verde sutil (base) → rubro escuro (médio) → vermelho vivo Black Friday (pico). */
  function corCalor(t) {
    const paradas = [
      [12, 24, 19],    // Preto esmeralda profundo (ritmo base)
      [68, 12, 18],    // Rubro negro intermediário
      [210, 16, 34],   // Vermelho Black Friday intenso (pico)
    ];
    const x = Math.min(Math.max(t, 0), 1) * 2;
    const i = Math.min(Math.floor(x), 1);
    const f = x - i;
    const [a, b] = [paradas[i], paradas[i + 1]];
    return `rgb(${a.map((c, j) => Math.round(c + (b[j] - c) * f)).join(",")})`;
  }

  function escala(setor) {
    const valores = lojaAtual.diario[setor].filter((v) => v > 0);
    const min = valores.length ? Math.min(...valores) : 0;
    const max = valores.length ? Math.max(...valores) : 0;
    return { min, max, norm: (v) => (max > min ? (v - min) / (max - min) : 1) };
  }

  function montarCalendario() {
    const valores = lojaAtual.diario[setorCalendario];
    const { norm } = escala(setorCalendario);
    const top3 = new Set(rankDias(setorCalendario).filter((d) => d.valor > 0).slice(0, 3).map((d) => d.dia));
    const hoje = diaDeHoje();
    const primeiroDiaSemana = new Date(DADOS.ano, DADOS.mes - 1, 1).getDay();

    let html = '<div class="dia vazio-mes"></div>'.repeat(primeiroDiaSemana);
    valores.forEach((v, i) => {
      const dia = i + 1;
      const classes = ["dia"];
      if (!v) classes.push("sem-meta");
      if (dia === hoje) classes.push("hoje");
      if (dia === diaSelecionado) classes.push("selecionado");
      const estilo = v ? `background:${corCalor(norm(v))}` : "";
      html += `
        <div class="${classes.join(" ")}" style="${estilo}" data-dia="${dia}" title="Dia ${dia}: ${brl.format(v)}">
          <div class="dia-topo">
            <span class="num">${String(dia).padStart(2, "0")}</span>
            ${top3.has(dia) ? '<span class="fogo" title="Top 3 do mês">PICO</span>' : ""}
          </div>
          <span class="val">${v ? brlCompacto.format(v) : "—"}</span>
        </div>`;
    });
    $("dias").innerHTML = html;
    $("dias").onclick = (e) => {
      const el = e.target.closest(".dia[data-dia]");
      if (el) selecionarDia(Number(el.dataset.dia));
    };
    atualizarTermometro();
  }

  function selecionarDia(dia) {
    diaSelecionado = dia;
    document.querySelectorAll(".dia[data-dia]").forEach((el) => el.classList.toggle("selecionado", Number(el.dataset.dia) === dia));
    atualizarTermometro();
  }

  function atualizarTermometro() {
    const setor = setorCalendario;
    const valor = lojaAtual.diario[setor][diaSelecionado - 1] || 0;
    const { min, max, norm } = escala(setor);
    const t = valor ? norm(valor) : 0;

    $("termo-max").textContent = brlCompacto.format(max);
    $("termo-min").textContent = brlCompacto.format(min);
    // altura mínima de 8% para o tubo nunca ficar "vazio" num dia com meta
    $("termo-fill").style.height = `${valor ? 8 + t * 92 : 0}%`;
    document.querySelector(".bulbo").style.background = valor ? corCalor(t) : "var(--bg2)";

    const data = new Date(DADOS.ano, DADOS.mes - 1, diaSelecionado);
    $("detalhe-data").textContent = `${SEMANA[data.getDay()]}, ${diaSelecionado} de ${DADOS.mesNome.toLowerCase()}`;
    $("detalhe-valor").textContent = brl.format(valor);

    const posicao = rankDias(setor).findIndex((d) => d.dia === diaSelecionado) + 1;
    const totalMes = lojaAtual.meta[setor] || lojaAtual.diario[setor].reduce((a, b) => a + b, 0);
    $("detalhe-rank").textContent = valor
      ? `${posicao}º maior dia do mês · ${pct(valor / (totalMes || 1))} da meta ${setor === "total" ? "do mês" : "do setor"}`
      : "Sem meta neste dia";

    $("detalhe-setores").innerHTML =
      setor === "total"
        ? Object.keys(DADOS.setores)
            .filter((k) => lojaAtual.meta[k] > 0)
            .map((k) => `<li><span><i class="dot-setor" style="background:${SETOR_INFO[k].cor}"></i>${SETOR_INFO[k].rotulo}</span><span class="mono">${brl.format(lojaAtual.diario[k][diaSelecionado - 1] || 0)}</span></li>`)
            .join("")
        : "";
  }

  function montarTopDias() {
    const top = rankDias(setorCalendario).filter((d) => d.valor > 0).slice(0, 5);
    $("top-dias").innerHTML = top
      .map((d, i) => {
        const data = new Date(DADOS.ano, DADOS.mes - 1, d.dia);
        return `
          <article class="card top-dia" data-dia="${d.dia}">
            <span class="pos">${i + 1}º</span>
            <div>
              <strong>${d.dia}/${String(DADOS.mes).padStart(2, "0")} · ${SEMANA[data.getDay()]}</strong>
              <small>${brl.format(d.valor)}</small>
            </div>
          </article>`;
      })
      .join("");
    $("top-dias").onclick = (e) => {
      const el = e.target.closest(".top-dia");
      if (!el) return;
      selecionarDia(Number(el.dataset.dia));
      document.querySelector(".calendario-card").scrollIntoView({ behavior: "smooth", block: "center" });
    };
  }

  // ---------------- início ----------------
  if (!DADOS || !DADOS.lojas) {
    document.body.innerHTML = '<p style="padding:2rem">Arquivo <b>data.js</b> não encontrado. Rode <code>python scripts/exportar_dados.py</code>.</p>';
    return;
  }
  iniciarLogin();
  const salva = JSON.parse(localStorage.getItem(CHAVE_SESSAO) || "null");
  if (salva) {
    if (salva.nome) localStorage.setItem(CHAVE_NOME, salva.nome);
    entrar(salva);
  }
})();

