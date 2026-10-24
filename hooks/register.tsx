import type { Register } from 'claude-code'

import type { Stand } from '../types'

const stand = { plugin: 'kontext-waechter', key: 'stand' } as const
const isHidden = { plugin: 'kontext-waechter', key: 'isHidden' } as const
const isBusy = { plugin: 'kontext-waechter', key: 'isBusy' } as const

const ORDNER = '.claude/uebergabe'
const LETZTE = `${ORDNER}/LETZTE.md`
const GELESEN = `${ORDNER}/gelesen.txt`

// Schwellen in Prozent des Kontextfensters. Jede Antwort schickt den ganzen
// Verlauf erneut mit, darum wird jede weitere Runde teurer.
const BEOBACHTEN = 50
const SINNVOLL = 70
const DRINGEND = 85

const UEBERGABE_PROMPT = `Schreibe jetzt eine Übergabe für eine neue Session, die dieses Gespräch nicht kennt und nahtlos weiterarbeiten soll. Antworte nur mit dem Dokument, ohne Einleitung, auf Deutsch, in Markdown, so knapp wie möglich, aber vollständig:

# Übergabe
## Ziel
Was soll am Ende erreicht sein, und warum.
## Stand
Was ist fertig, was läuft gerade, was ist noch offen.
## Entscheidungen
Getroffene Entscheidungen samt Begründung, damit sie nicht neu diskutiert werden.
## Wichtige Orte
Dateien, Ordner, Befehle, Adressen, die gebraucht werden (mit vollständigen Pfaden).
## Nächste Schritte
Geordnete Liste, der erste Punkt ist sofort ausführbar.
## Stolpersteine
Fehlschläge, Sackgassen und Eigenheiten, die man sonst wieder erleben würde.
## Vorlieben des Nutzers
Wie der Nutzer arbeiten möchte, soweit im Gespräch sichtbar.

Keine Vermutungen als Tatsachen darstellen. Nichts aufnehmen, was sich leicht aus dem Code oder Git-Verlauf ablesen lässt.`

type Stufe = { text: string; color: 'success' | 'warning' | 'error'; rank: number }

const stufe = (percent: number): Stufe => {
  if (percent >= DRINGEND) {
    return { rank: 3, color: 'error', text: 'Jetzt zusammenfassen lassen und neue Session starten' }
  }
  if (percent >= SINNVOLL) {
    return { rank: 2, color: 'warning', text: 'Zusammenfassung und neue Session lohnen sich jetzt' }
  }
  if (percent >= BEOBACHTEN) {
    return { rank: 1, color: 'warning', text: 'Kontext füllt sich, bei einem Themenwechsel neu starten' }
  }
  return { rank: 0, color: 'success', text: 'Kontext frei, weiterarbeiten' }
}

const balken = (percent: number) => {
  const full = Math.max(0, Math.min(10, Math.round(percent / 10)))
  return '█'.repeat(full) + '░'.repeat(10 - full)
}

const k = (n: number) => (n >= 1000 ? `${Math.round(n / 1000)}k` : `${n}`)

const stempel = (text: string) => {
  const m = /<!-- erstellt: (\d+) -->/.exec(text)
  return m === null ? '' : m[1]
}

const dateiname = (ms: number) =>
  new Date(ms).toISOString().slice(0, 16).replace('T', '_').replace(':', '-')

export const register: Register = on => {
  let turns = 0
  let lastRank = 0
  let agentRuns = 0
  let agentTokens = 0

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'waechter',
      description: 'Kontext-Wächter: Anzeige ein-/ausblenden',
    })
    await $.command.register({
      name: 'uebergabe',
      description: 'Zusammenfassung für die nächste Session erstellen und speichern',
    })
    await $.command.register({
      name: 'weiter',
      description: 'Letzte Übergabe laden und damit weiterarbeiten',
    })

    try {
      const letzte = await $.fs.read(LETZTE)
      let gelesen = ''
      try {
        gelesen = await $.fs.read(GELESEN)
      } catch {
        gelesen = ''
      }
      if (stempel(letzte) !== '' && stempel(letzte) !== gelesen.trim()) {
        $.ui.toast('Übergabe der letzten Session gefunden. Mit /weiter laden.')
      }
    } catch {
      // keine Übergabe vorhanden
    }

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined) {
      turns += 1
      const u = await $.session.usage()
      const percent = u.context.percent ?? 0
      const s: Stand = {
        percent,
        tokens: u.context.tokens ?? 0,
        window: u.context.window,
        usd: u.cost?.usd ?? null,
        turns,
        agentRuns,
        agentTokens,
      }
      await $.state.set(stand, s)

      const st = stufe(percent)
      $.ui.status(`Kontext ${percent}% ${balken(percent)}`)
      if (st.rank > lastRank && st.rank >= 2) {
        $.ui.toast(`Kontext ${percent}% voll: ${st.text}.`)
      }
      lastRank = st.rank
    } else if (e.usage !== undefined) {
      // Subagenten haben ein eigenes Fenster: sie zählen nur in den Verbrauch,
      // nicht in den Füllstand der Hauptsession.
      agentRuns += 1
      agentTokens +=
        e.usage.input_tokens + e.usage.output_tokens + e.usage.cache_creation_input_tokens
      const { value: s = null } = await $.state.get(stand)
      if (s !== null) {
        await $.state.set(stand, { ...s, agentRuns, agentTokens })
      }
    }
    return next(e)
  })

  on('command.run', { command: 'waechter' }, async $ => {
    const { value: hidden = false } = await $.state.get(isHidden)
    await $.state.set(isHidden, !hidden)

    // Gleich messen: in einer Session, in der die Mod eben erst geladen wurde,
    // gibt es sonst bis zur nächsten Antwort keinen Wert und keine Leiste.
    const u = await $.session.usage()
    const percent = u.context.percent ?? 0
    const s: Stand = {
      percent,
      tokens: u.context.tokens ?? 0,
      window: u.context.window,
      usd: u.cost?.usd ?? null,
      turns,
      agentRuns,
      agentTokens,
    }
    await $.state.set(stand, s)
    $.ui.status(`Kontext ${percent}% ${balken(percent)}`)
    lastRank = stufe(percent).rank

    const st = stufe(percent)
    const stand_ = s.tokens === 0
      ? 'Noch keine Antwort in dieser Session gemessen, die Leiste füllt sich nach der nächsten Antwort.'
      : `Stand: ${percent}% (${k(s.tokens)} von ${k(s.window)} Tokens). ${st.text}.`

    return { text: `Kontext-Wächter ${hidden ? 'eingeblendet' : 'ausgeblendet'}. ${stand_}` }
  })

  on('command.run', { command: 'uebergabe' }, async $ => {
    const { value: busy = false } = await $.state.get(isBusy)
    if (busy) {
      return { text: 'Die Übergabe wird gerade erstellt.' }
    }
    await $.state.set(isBusy, true)
    const r = await $.model.fork({ prompt: UEBERGABE_PROMPT })
    await $.state.set(isBusy, false)

    if (!r.isAnswered) {
      return { text: `Übergabe nicht möglich (${r.reason}). Nach der ersten Antwort noch einmal versuchen.` }
    }

    const jetzt = await $.clock.now()
    const d = dateiname(jetzt)
    const doc = `<!-- erstellt: ${jetzt} -->\n${r.text.trim()}\n`
    await $.fs.write(`${ORDNER}/uebergabe-${d}.md`, doc)
    await $.fs.write(LETZTE, doc)

    return {
      text:
        `Übergabe gespeichert in ${LETZTE} (Kopie: uebergabe-${d}.md). ` +
        'In der neuen Session einfach /weiter eingeben.',
    }
  })

  on('command.run', { command: 'weiter' }, async $ => {
    let doc = ''
    try {
      doc = await $.fs.read(LETZTE)
    } catch {
      return { text: `Keine Übergabe gefunden (${LETZTE}). Erst /uebergabe in der alten Session ausführen.` }
    }
    await $.fs.write(GELESEN, stempel(doc))
    void $.prompt.submit({
      text:
        'Hier ist die Übergabe der vorherigen Session. Lies sie, fasse in zwei Sätzen zusammen, ' +
        'wo wir stehen, und mach dann mit dem ersten nächsten Schritt weiter.\n\n' +
        doc,
    })

    return { text: 'Übergabe wird geladen.' }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const { value: s = null } = await $.state.get(stand)
    const { value: hidden = false } = await $.state.get(isHidden)
    const { value: busy = false } = await $.state.get(isBusy)

    if (e.props.hasSurvey || s === null || hidden) {
      return next(e)
    }

    const { Box, Text, Button } = $.ui.resolve(e)
    const st = stufe(s.percent)
    const cost = s.usd === null ? '' : ` · $${s.usd.toFixed(2)}`
    const runs = s.agentRuns ?? 0
    const agents = runs === 0 ? '' : ` · Agenten ${runs}×, ${k(s.agentTokens ?? 0)}`

    return (
      <Box>
        <Text color={st.color}>
          {balken(s.percent)} {s.percent}%{' '}
        </Text>
        <Text dimColor>
          ({k(s.tokens)}/{k(s.window)}
          {cost}
          {agents}){' '}
        </Text>
        <Text color={st.color}>{st.text} </Text>
        {busy ? (
          <Text dimColor>Übergabe wird erstellt… </Text>
        ) : (
          <Button
            key="uebergabe"
            label="Übergabe erstellen"
            onPress={async () => {
              await $.state.set(isBusy, true)
              const r = await $.model.fork({ prompt: UEBERGABE_PROMPT })
              await $.state.set(isBusy, false)
              if (!r.isAnswered) {
                $.ui.toast(`Übergabe nicht möglich (${r.reason}).`)
                return
              }
              const jetzt = await $.clock.now()
              const doc = `<!-- erstellt: ${jetzt} -->\n${r.text.trim()}\n`
              await $.fs.write(`${ORDNER}/uebergabe-${dateiname(jetzt)}.md`, doc)
              await $.fs.write(LETZTE, doc)
              $.ui.toast('Übergabe gespeichert. In der neuen Session /weiter eingeben.')
            }}
          />
        )}{' '}
        <Button key="hide" label="Ausblenden" onPress={() => $.state.set(isHidden, true)} />
      </Box>
    )
  })
}
