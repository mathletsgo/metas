(() => {
  "use strict";

  const DADOS = window.METAS;
  const CHAVE_SESSAO = "metaLojas.sessao";
  const CHAVE_NOME = "metaLojas.nome";
  const DURACAO_BOAS_VINDAS = 3200; // ms
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

  // Formato enxuto para caber perfeitamente nas células do calendário mobile (ex: 36k, 1,2M)
  function fmtCalCurto(v) {
    if (!v || v <= 0) return "—";
    if (v >= 1000000) return `${(v / 1000000).toFixed(1).replace(".", ",")}M`;
    if (v >= 1000) return `${Math.round(v / 1000)}k`;
    return String(Math.round(v));
  }

  function vibrarLeve(ms = 10) {
    try {
      if (navigator.vibrate) navigator.vibrate(ms);
    } catch (_) {
      // Ignora em dispositivos sem suporte
    }
  }

  let lojaAtual = null;
  let setorCalendario = "total";
  let diaSelecionado = 1;
  let scrollObserver = null;

  // ---------------- navegação ----------------
  function mostrarTela(id) {
    document.querySelectorAll(".tela").forEach((t) => t.classList.toggle("ativa", t.id === id));
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  const rotuloLoja = (l) => l.nome || `Loja ${l.codigo}`;

  function acharLoja(texto) {
    const t = String(texto || "").trim().toLowerCase();
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

    const opcoesSelect = DADOS.lojas
      .map((l) => `<option value="${l.codigo}">${rotuloLoja(l)}</option>`)
      .join("");

    $("seletor-loja-topo").innerHTML = opcoesSelect;

    const selectLogin = $("select-loja-login");
    if (selectLogin) {
      selectLogin.innerHTML = `<option value="">Toque para escolher sua unidade...</option>` + opcoesSelect;
      selectLogin.addEventListener("change", (e) => {
        const cod = Number(e.target.value);
        const loja = DADOS.lojas.find((l) => l.codigo === cod);
        if (loja) {
          $("campo-loja").value = rotuloLoja(loja);
          $("erro-login").hidden = true;
          vibrarLeve(12);
        }
      });
    }

    $("campo-loja").addEventListener("input", (e) => {
      const loja = acharLoja(e.target.value);
      if (selectLogin) {
        selectLogin.value = loja ? String(loja.codigo) : "";
      }
    });

    $("seletor-loja-topo").addEventListener("change", (e) => {
      const novoCodigo = Number(e.target.value);
      const novaLoja = DADOS.lojas.find((l) => l.codigo === novoCodigo);
      if (!novaLoja) return;
      vibrarLeve(15);
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
      const valorCampo = $("campo-loja").value || (selectLogin ? selectLogin.value : "");
      const loja = acharLoja(valorCampo);
      const nome = $("campo-nome").value.trim();
      const erro = $("erro-login");

      if (!loja) {
        erro.textContent = "Unidade não encontrada. Selecione na lista acima ou digite o código.";
        erro.hidden = false;
        vibrarLeve(30);
        return;
      }
      if (!nome) {
        erro.textContent = "Informe seu nome para continuar.";
        erro.hidden = false;
        vibrarLeve(30);
        return;
      }
      erro.hidden = true;
      vibrarLeve(18);
      const nomeFormatado = capitalizar(nome);
      const sessao = { codigo: loja.codigo, nome: nomeFormatado };
      localStorage.setItem(CHAVE_NOME, nomeFormatado);
      localStorage.setItem(CHAVE_SESSAO, JSON.stringify(sessao));
      entrar(sessao);
    });

    $("btn-sair").addEventListener("click", () => {
      vibrarLeve(12);
      localStorage.removeItem(CHAVE_SESSAO);
      $("campo-nome").value = localStorage.getItem(CHAVE_NOME) || "";
      $("campo-loja").value = "";
      if (selectLogin) selectLogin.value = "";
      mostrarTela("tela-login");
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
      ativarRevealAoRolar();
    }, DURACAO_BOAS_VINDAS);
  }

  // ---------------- clima da regional ----------------
  const CIDADES_REGIONAL = {
    df: { lat: -15.7975, lon: -47.8919, nome: "Brasília/DF" },
    go: { lat: -16.6869, lon: -49.2648, nome: "Goiânia/GO" },
    anp: { lat: -16.3268, lon: -48.9534, nome: "Anápolis/GO" },
    mt: { lat: -15.6014, lon: -56.0979, nome: "Cuiabá/MT" },
    sinop: { lat: -11.8608, lon: -55.5095, nome: "Sinop/MT" },
    to: { lat: -10.1844, lon: -48.3336, nome: "Palmas/TO" },
  };

  function climaDescPorWmo(codigo) {
    if (codigo === 0) return { desc: "Ensolarado", icon: "☀️" };
    if (codigo === 1 || codigo === 2) return { desc: "Parcialmente nublado", icon: "⛅" };
    if (codigo === 3) return { desc: "Nublado", icon: "☁️" };
    if (codigo >= 45 && codigo <= 48) return { desc: "Nevoeiro", icon: "🌫️" };
    if (codigo >= 51 && codigo <= 67) return { desc: "Chuva fraca", icon: "🌦️" };
    if (codigo >= 80 && codigo <= 82) return { desc: "Pancadas de chuva", icon: "🌧️" };
    if (codigo >= 95) return { desc: "Trovoadas", icon: "⛈️" };
    return { desc: "Tempo bom", icon: "🌤️" };
  }

  let previsaoCache = {};

  function carregarClimaRegional(loja) {
    const nome = (loja && (loja.nome || "")).toUpperCase();
    let reg = CIDADES_REGIONAL.df;
    if (nome.includes("ANP/")) reg = CIDADES_REGIONAL.anp;
    else if (nome.includes("/GO") || nome.includes("GOI/")) reg = CIDADES_REGIONAL.go;
    else if (nome.includes("SINOP")) reg = CIDADES_REGIONAL.sinop;
    else if (nome.includes("-MT") || nome.includes("CUIABA")) reg = CIDADES_REGIONAL.mt;
    else if (nome.includes("/TO") || nome.includes("DOURADO")) reg = CIDADES_REGIONAL.to;

    const elIcon = $("clima-icone");
    const elTemp = $("clima-temp");
    const elDesc = $("clima-desc");
    if (!elTemp) return;

    const hora = new Date().getHours();
    const tempEstimada = hora >= 11 && hora <= 16 ? 30 : 25;
    elTemp.textContent = `${tempEstimada}°C`;
    elDesc.textContent = reg.nome;
    if (elIcon) elIcon.textContent = hora >= 6 && hora <= 18 ? "☀️" : "🌙";

    if ($("previsao-titulo-cidade")) {
      $("previsao-titulo-cidade").textContent = `Previsão: ${reg.nome}`;
    }

    // Busca clima atual + previsão diária para os próximos 4 dias
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${reg.lat}&longitude=${reg.lon}&current_weather=true&daily=weathercode,temperature_2m_max,temperature_2m_min&timezone=auto`)
      .then((r) => r.json())
      .then((data) => {
        if (data && data.current_weather) {
          const t = Math.round(data.current_weather.temperature);
          const wmo = climaDescPorWmo(data.current_weather.weathercode);
          elTemp.textContent = `${t}°C`;
          elDesc.textContent = `${reg.nome} • ${wmo.desc}`;
          if (elIcon) elIcon.textContent = wmo.icon;
        }

        if (data && data.daily && Array.isArray(data.daily.time)) {
          previsaoCache = {
            cidade: reg.nome,
            dias: data.daily.time.slice(0, 5).map((diaStr, idx) => {
              const dt = new Date(`${diaStr}T12:00:00`);
              const wmo = climaDescPorWmo(data.daily.weathercode[idx]);
              return {
                data: dt,
                dataFmt: `${String(dt.getDate()).padStart(2, "0")}/${String(dt.getMonth() + 1).padStart(2, "0")}`,
                diaSemana: SEMANA[dt.getDay()],
                max: Math.round(data.daily.temperature_2m_max[idx]),
                min: Math.round(data.daily.temperature_2m_min[idx]),
                desc: wmo.desc,
                icon: wmo.icon,
              };
            }),
          };
          renderizarPopoverPrevisao();
        }
      })
      .catch(() => {
        elDesc.textContent = reg.nome;
      });
  }

  function renderizarPopoverPrevisao() {
    const lista = $("lista-previsao-dias");
    if (!lista || !previsaoCache.dias) return;

    const diasExibir = previsaoCache.dias.slice(1, 5);
    lista.innerHTML = diasExibir
      .map((d) => `
        <div class="item-previsao-dia">
          <div class="previsao-dia-info">
            <span class="previsao-dia-icone">${d.icon}</span>
            <div class="previsao-dia-titulos">
              <span class="previsao-dia-nome">${d.diaSemana} · <small style="color:var(--texto2);font-weight:400">${d.dataFmt}</small></span>
              <span class="previsao-dia-desc">${d.desc}</span>
            </div>
          </div>
          <div class="previsao-dia-temps">
            <span class="temp-max" title="Máxima">▲ ${d.max}°</span>
            <span class="temp-min" title="Mínima">▼ ${d.min}°</span>
          </div>
        </div>
      `)
      .join("");
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
      .map((k, idx) => {
        const info = SETOR_INFO[k];
        const val = lojaAtual.diario[k][dia - 1] || 0;
        const p = totalDia > 0 ? val / totalDia : 0;
        const semMeta = lojaAtual.meta[k] <= 0 && val <= 0;
        return `
          <div class="hero-setor-item ${semMeta ? "vazio" : ""}" style="--cor-setor:${info.cor};--stagger:${idx * 55}ms">
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
    $("sub-hoje").textContent = `${SEMANA[dataBase.getDay()]} • ${pct(valorHoje / (l.meta.total || 1))} do mês`;

    if (proxDia) {
      const valorAmanha = l.diario.total[proxDia - 1] || 0;
      const dataProx = new Date(DADOS.ano, DADOS.mes - 1, proxDia);
      const proxDiaFmt = `${String(proxDia).padStart(2, "0")}/${mesStr}`;
      const diff = valorHoje > 0 ? (valorAmanha - valorHoje) / valorHoje : 0;
      const sinal = diff >= 0 ? `▲ +${(diff * 100).toFixed(1).replace(".", ",")}%` : `▼ ${(diff * 100).toFixed(1).replace(".", ",")}%`;

      $("rotulo-amanha").textContent = `Prévia amanhã (${proxDiaFmt})`;
      $("meta-amanha").textContent = brl.format(valorAmanha);
      $("sub-amanha").textContent = `${SEMANA[dataProx.getDay()]} • ${sinal} vs hoje`;
      $("titulo-setores-amanha").textContent = `PRÉVIA AMANHÃ • ${proxDiaFmt} (${SEMANA[dataProx.getDay()].toUpperCase()})`;
    } else {
      $("rotulo-amanha").textContent = "Próximo dia";
      $("meta-amanha").textContent = "Fim do mês";
      $("sub-amanha").textContent = "Último dia do calendário";
      $("titulo-setores-amanha").textContent = "PRÉVIA DO PRÓXIMO DIA";
    }

    $("titulo-setores-hoje").textContent = `META DE HOJE • ${diaBaseFmt} (${SEMANA[dataBase.getDay()].toUpperCase()})`;
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
    carregarClimaRegional(l);
    ativarRevealAoRolar();

    const gerado = new Date(DADOS.geradoEm);
    $("rodape").textContent = `Dados atualizados em ${gerado.toLocaleDateString("pt-BR")} às ${gerado.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
  }

  function montarSetores() {
    const total = lojaAtual.meta.total || 1;
    $("setores").innerHTML = Object.keys(DADOS.setores)
      .map((k, idx) => {
        const info = SETOR_INFO[k];
        const v = lojaAtual.meta[k] || 0;
        const p = v / total;
        const larguraPct = (p * 100).toFixed(1);
        return `
          <article class="card setor reveal-card ${v ? "" : "vazio"}" style="--cor-setor:${info.cor};--stagger:${idx * 70}ms;--largura-barra:${larguraPct}%" data-setor="${k}">
            <div class="setor-topo">
              <span class="setor-tag" style="color:${info.cor};border-color:${info.cor}44;background:${info.cor}14">${info.sigla}</span>
              <span class="setor-share">${v ? pct(p) : "0,0%"}</span>
            </div>
            <h3>${info.rotulo}</h3>
            <p class="valor">${v ? brl.format(v) : "Sem meta"}</p>
            <p class="pct">${v ? "Toque para ver no calendário →" : "Sem meta alocada no período"}</p>
            <div class="barrinha"><div style="width:${larguraPct}%;background:${info.cor}"></div></div>
          </article>`;
      })
      .join("");

    $("setores").onclick = (e) => {
      const card = e.target.closest(".setor[data-setor]:not(.vazio)");
      if (!card) return;
      vibrarLeve(15);
      const k = card.dataset.setor;
      const btn = document.querySelector(`.aba[data-setor="${k}"]`);
      if (btn) {
        btn.click();
        document.querySelector(".calendario-card").scrollIntoView({ behavior: "smooth", block: "start" });
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
      vibrarLeve(10);
      setorCalendario = btn.dataset.setor;
      document.querySelectorAll(".aba").forEach((b) => b.classList.toggle("ativa", b === btn));
      btn.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
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

  /** Cor do "termômetro" Black-on-Black: preto esmeralda (base) → rubro escuro (médio) → vermelho vivo Black Friday (pico). */
  function corCalor(t) {
    const paradas = [
      [12, 26, 20],    // Preto esmeralda profundo (ritmo base)
      [74, 12, 19],    // Rubro negro intermediário
      [218, 18, 36],   // Vermelho Black Friday intenso (pico)
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
      if (top3.has(dia)) classes.push("pico-top3");
      if (dia === diaSelecionado) classes.push("selecionado");
      const estilo = v ? `background:${corCalor(norm(v))};` : "";
      html += `
        <div class="${classes.join(" ")}" style="--dia-delay:${i * 12}ms;${estilo}" data-dia="${dia}" title="Dia ${dia}: ${brl.format(v)}">
          <div class="dia-topo">
            <span class="num">${String(dia).padStart(2, "0")}</span>
            ${top3.has(dia) ? '<span class="fogo" title="Top 3 do mês">PICO</span>' : ""}
          </div>
          <span class="val val-desktop">${v ? brlCompacto.format(v) : "—"}</span>
          <span class="val val-mobile">${fmtCalCurto(v)}</span>
        </div>`;
    });
    $("dias").innerHTML = html;
    $("dias").onclick = (e) => {
      const el = e.target.closest(".dia[data-dia]");
      if (el) {
        vibrarLeve(10);
        selecionarDia(Number(el.dataset.dia), true);
      }
    };
    atualizarTermometro(false);
  }

  function selecionarDia(dia, animarPulso = false) {
    const diaClamp = Math.max(1, Math.min(DADOS.diasNoMes, dia));
    if (diaClamp === diaSelecionado && !animarPulso) return;
    diaSelecionado = diaClamp;
    document.querySelectorAll(".dia[data-dia]").forEach((el) => el.classList.toggle("selecionado", Number(el.dataset.dia) === diaSelecionado));
    atualizarTermometro(animarPulso);
  }

  function atualizarTermometro(animarPulso = false) {
    const setor = setorCalendario;
    const valor = lojaAtual.diario[setor][diaSelecionado - 1] || 0;
    const { min, max, norm } = escala(setor);
    const t = valor ? norm(valor) : 0;

    $("termo-max").textContent = brlCompacto.format(max);
    $("termo-min").textContent = brlCompacto.format(min);
    $("termo-fill").style.height = `${valor ? 8 + t * 92 : 0}%`;
    $("termo-fill").style.width = `${valor ? 8 + t * 92 : 0}%`;
    document.querySelector(".bulbo").style.background = valor ? corCalor(t) : "var(--bg2)";

    const data = new Date(DADOS.ano, DADOS.mes - 1, diaSelecionado);
    $("detalhe-data").textContent = `${SEMANA[data.getDay()]}, ${String(diaSelecionado).padStart(2, "0")}/${String(DADOS.mes).padStart(2, "0")}`;
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

    if ($("btn-dia-ant")) $("btn-dia-ant").disabled = diaSelecionado <= 1;
    if ($("btn-dia-prox")) $("btn-dia-prox").disabled = diaSelecionado >= DADOS.diasNoMes;

    if (animarPulso) {
      const painel = $("painel-detalhe-dia");
      if (painel) {
        painel.classList.remove("pulso-troca");
        void painel.offsetWidth;
        painel.classList.add("pulso-troca");
      }
    }
  }

  function montarTopDias() {
    const top = rankDias(setorCalendario).filter((d) => d.valor > 0).slice(0, 5);
    $("top-dias").innerHTML = top
      .map((d, i) => {
        const data = new Date(DADOS.ano, DADOS.mes - 1, d.dia);
        return `
          <article class="card top-dia reveal-card" style="--stagger:${i * 65}ms" data-dia="${d.dia}">
            <span class="pos">${i + 1}º</span>
            <div>
              <strong>${String(d.dia).padStart(2, "0")}/${String(DADOS.mes).padStart(2, "0")} · ${SEMANA[data.getDay()]}</strong>
              <small>${brl.format(d.valor)}</small>
            </div>
          </article>`;
      })
      .join("");
    $("top-dias").onclick = (e) => {
      const el = e.target.closest(".top-dia");
      if (!el) return;
      vibrarLeve(15);
      selecionarDia(Number(el.dataset.dia), true);
      document.querySelector(".calendario-card").scrollIntoView({ behavior: "smooth", block: "center" });
    };
  }

  // ---------------- animações de scroll, gestos touch e barra mobile ----------------
  function ativarRevealAoRolar() {
    const itens = document.querySelectorAll(".reveal-on-scroll, .reveal-card");
    if (!("IntersectionObserver" in window)) {
      itens.forEach((el) => el.classList.add("visivel"));
      return;
    }
    if (!scrollObserver) {
      scrollObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add("visivel");
            }
          });
        },
        { threshold: 0.1, rootMargin: "0px 0px -25px 0px" }
      );
    }
    itens.forEach((el) => scrollObserver.observe(el));
  }

  function iniciarInteracoesMobile() {
    // 1. Botões Anterior / Próximo dia no painel de detalhes
    if ($("btn-dia-ant")) {
      $("btn-dia-ant").addEventListener("click", () => {
        if (diaSelecionado > 1) {
          vibrarLeve(10);
          selecionarDia(diaSelecionado - 1, true);
        }
      });
    }
    if ($("btn-dia-prox")) {
      $("btn-dia-prox").addEventListener("click", () => {
        if (diaSelecionado < DADOS.diasNoMes) {
          vibrarLeve(10);
          selecionarDia(diaSelecionado + 1, true);
        }
      });
    }

    // 2. Gesto de Swipe (deslizar o dedo para esquerda/direita) no card de detalhes do dia
    const painelDetalhe = $("painel-detalhe-dia");
    if (painelDetalhe) {
      let touchX0 = 0;
      let touchY0 = 0;
      painelDetalhe.addEventListener(
        "touchstart",
        (e) => {
          if (e.touches.length === 1) {
            touchX0 = e.touches[0].clientX;
            touchY0 = e.touches[0].clientY;
          }
        },
        { passive: true }
      );
      painelDetalhe.addEventListener(
        "touchend",
        (e) => {
          if (!e.changedTouches.length) return;
          const dx = e.changedTouches[0].clientX - touchX0;
          const dy = e.changedTouches[0].clientY - touchY0;
          if (Math.abs(dx) > 42 && Math.abs(dx) > Math.abs(dy) * 1.4) {
            vibrarLeve(12);
            if (dx < 0 && diaSelecionado < DADOS.diasNoMes) {
              selecionarDia(diaSelecionado + 1, true);
            } else if (dx > 0 && diaSelecionado > 1) {
              selecionarDia(diaSelecionado - 1, true);
            }
          }
        },
        { passive: true }
      );
    }

    // 3. Clique no widget de clima para abrir/fechar a previsão dos próximos 4 dias
    const btnClima = $("topo-clima");
    const popoverPrevisao = $("popover-previsao");
    const btnFecharPrevisao = $("btn-fechar-previsao");

    if (btnClima && popoverPrevisao) {
      btnClima.addEventListener("click", (e) => {
        e.stopPropagation();
        vibrarLeve(10);
        const estaAberto = !popoverPrevisao.hidden;
        popoverPrevisao.hidden = estaAberto;
        btnClima.classList.toggle("aberto", !estaAberto);
      });

      if (btnFecharPrevisao) {
        btnFecharPrevisao.addEventListener("click", (e) => {
          e.stopPropagation();
          vibrarLeve(8);
          popoverPrevisao.hidden = true;
          btnClima.classList.remove("aberto");
        });
      }

      document.addEventListener("click", (e) => {
        if (!popoverPrevisao.hidden && !popoverPrevisao.contains(e.target) && !btnClima.contains(e.target)) {
          popoverPrevisao.hidden = true;
          btnClima.classList.remove("aberto");
        }
      });
    }

    // 4. Barra de progresso de leitura no topo + destaque da seção na barra inferior mobile
    const barraTopo = $("barra-scroll-topo");
    const botoesNav = document.querySelectorAll(".nav-mobile-btn");
    const secoesIds = ["secao-calendario", "secao-hero", "secao-setores", "secao-top"];

    botoesNav.forEach((btn) => {
      btn.addEventListener("click", () => {
        const alvoId = btn.dataset.alvo;
        const el = $(alvoId);
        if (!el) return;
        vibrarLeve(12);
        botoesNav.forEach((b) => b.classList.toggle("ativo", b === btn));
        const yOffset = -78;
        const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset;
        window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
      });
    });

    let ticking = false;
    window.addEventListener(
      "scroll",
      () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
          const scrollTop = window.scrollY || document.documentElement.scrollTop;
          const docHeight = document.documentElement.scrollHeight - window.innerHeight;
          const progresso = docHeight > 0 ? Math.min(100, Math.max(0, (scrollTop / docHeight) * 100)) : 0;
          if (barraTopo) barraTopo.style.width = `${progresso}%`;

          // Atualiza botão ativo na barra inferior conforme rolagem
          let secaoAtiva = secoesIds[0];
          for (const id of secoesIds) {
            const el = $(id);
            if (el && el.getBoundingClientRect().top <= window.innerHeight * 0.38) {
              secaoAtiva = id;
            }
          }
          if (window.innerHeight + scrollTop >= document.documentElement.scrollHeight - 40) {
            secaoAtiva = "secao-top";
          }
          botoesNav.forEach((b) => b.classList.toggle("ativo", b.dataset.alvo === secaoAtiva));
          ticking = false;
        });
      },
      { passive: true }
    );
  }

  // ---------------- início ----------------
  if (!DADOS || !DADOS.lojas) {
    document.body.innerHTML = '<p style="padding:2rem">Arquivo <b>data.js</b> não encontrado. Rode <code>python scripts/exportar_dados.py</code>.</p>';
    return;
  }
  iniciarLogin();
  iniciarInteracoesMobile();
  const salva = JSON.parse(localStorage.getItem(CHAVE_SESSAO) || "null");
  if (salva) {
    if (salva.nome) localStorage.setItem(CHAVE_NOME, salva.nome);
    entrar(salva);
  }
})();
