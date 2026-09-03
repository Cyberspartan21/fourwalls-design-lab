/* Tag/Abend vor dem ersten Zeichnen des Inhalts setzen — sonst blitzt der
   Tagmodus auf. Regeln wie im Prototyp: ?mode=, #hell/#dunkel, gemerkt, hell.
   Der Text ist eine Konstante aus dieser Datei — keine Daten von aussen. */
const CODE = `(function(){var s="hell";try{var q=new URLSearchParams(location.search).get("mode"),h=(location.hash||"").slice(1);
if(q==="hell"||q==="dunkel")s=q;else if(h==="hell"||h==="dunkel")s=h;else{var v=localStorage.getItem("fw-ufer");if(v==="hell"||v==="dunkel")s=v;}}catch(e){}
document.body.dataset.mode=s;
addEventListener("hashchange",function(){var x=(location.hash||"").slice(1);if(x==="hell"||x==="dunkel"){document.body.dataset.mode=x;try{localStorage.setItem("fw-ufer",x)}catch(e){}}});})();`;

export function ModusScript() {
  // eslint-disable-next-line react/no-danger -- statische Konstante, keine Nutzerdaten
  return <script dangerouslySetInnerHTML={{ __html: CODE }} />;
}
