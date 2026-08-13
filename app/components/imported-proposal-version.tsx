"use client";
import {useEffect,useMemo,useState} from "react";
import {safeInventoryReturnUrl} from "../lib/inventory-return-url";
import {mapProposalVersion} from "../lib/map-proposal-version";
import {formatRubles} from "../lib/proposal-money";
import {parseProposalVersion,type ProposalVersionResponse} from "../lib/proposal-version";
import {ProposalProvider} from "./proposal-context";
import {ProposalPreview} from "./proposal-preview";
function Content({contextId}:{contextId:string}){
 const[value,setValue]=useState<ProposalVersionResponse|null>(null),[error,setError]=useState("");
 useEffect(()=>{const controller=new AbortController();fetch(`/api/proposal-version/${encodeURIComponent(contextId)}`,{signal:controller.signal}).then(async response=>{if(!response.ok)throw new Error(response.status===404?"Версия КП не найдена.":"Inventory временно недоступен.");return parseProposalVersion(await response.json())}).then(setValue).catch(reason=>{if(!(reason instanceof DOMException&&reason.name==="AbortError"))setError(reason instanceof Error?reason.message:"Ошибка")});return()=>controller.abort()},[contextId]);
 const proposal=useMemo(()=>value?mapProposalVersion(value.data):null,[value]);
 if(error)return <main className="min-h-screen bg-stone-950 p-5 text-white"><h1>Не удалось загрузить КП</h1><p>{error}</p></main>;
 if(!value||!proposal)return <main className="min-h-screen bg-stone-950 p-5 text-white">Загружаем версию КП…</main>;
 const{data,liveCheck}=value,unit=data.unitSnapshot,back=safeInventoryReturnUrl(data.returnUrl),investment=data.investmentProjection;
 const metrics:Array<[string,string]> = investment?[["Сценарий",String(investment.scenarioLabel??"—")],["Доход, год 1",formatRubles(Number(investment.firstYearIncome??0))],["Доходность",`${Number(investment.firstYearYield??0).toFixed(1)}%`],["Рост стоимости",formatRubles(Number(investment.capitalGain??0))],["Горизонт",`${String(investment.horizonYears??"—")} лет`]]:[];
 return <main className="min-h-screen bg-stone-950 p-5 text-white lg:p-10"><div className="mx-auto max-w-6xl">{back&&<a className="text-amber-100" href={`${back}${back.includes("?")?"&":"?"}proposalVersion=${encodeURIComponent(data.id)}&sellSession=${encodeURIComponent(data.sellSessionId)}`}>← Вернуться к продаже</a>}<div className="mt-5 rounded-xl border border-emerald-300/30 p-4 text-emerald-100">Immutable ProposalVersion {data.id.slice(0,8)} · №{unit.unitNumber} · {formatRubles(unit.price)}</div>{(liveCheck.priceChanged||liveCheck.statusChanged)&&<div className="mt-3 rounded-xl border border-amber-300/30 p-4 text-amber-100">Данные объекта изменились после создания этой версии КП. Используются сохранённые snapshots.</div>}<header className="py-10"><p className="eyebrow">Готовое коммерческое предложение</p><h1 className="mt-3 font-serif text-5xl">Номер {unit.unitNumber}</h1><p className="mt-3 text-stone-400">{unit.floor} этаж · {unit.area??"—"} м²</p></header>{investment&&<section className="panel mb-5 p-6"><p className="eyebrow">Инвестиционный прогноз</p><dl className="mt-3 grid gap-3 sm:grid-cols-3">{metrics.map(([label,content])=><div key={label}><dt className="text-stone-500">{label}</dt><dd>{content}</dd></div>)}</dl></section>}<div className="max-w-sm"><ProposalPreview importedProposalData={proposal}/></div></div></main>;
}
export function ImportedProposalVersion({contextId}:{contextId:string}){return <ProposalProvider><Content contextId={contextId}/></ProposalProvider>}
