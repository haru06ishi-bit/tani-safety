"use strict";

// 小数計算の誤差を抑える。評価判定には表示用の丸めを使用しない。
const clean = value => Math.round(value * 1e10) / 1e10;
const format = value => new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 10 }).format(clean(value));

function read(id) {
  return document.getElementById(id).valueAsNumber;
}

function show(id, state, label, value, unit, detail, badge = "") {
  const result = document.getElementById(id);
  result.className = `result ${state}`;
  // 全ての文言は固定文字列または検証した数値のみで構成する。
  result.innerHTML = `<p class="result-label">${label}</p><p class="result-value">${value}<small>${unit}</small>${badge ? `<span class="result-badge">${badge}</span>` : ""}</p><p class="result-detail">${detail}</p>`;
}

function error(resultId, message, ids = []) {
  ids.forEach(id => document.getElementById(id).setAttribute("aria-invalid", "true"));
  show(resultId, "danger", "入力内容を確認してください", "—", "", message);
  return false;
}

function validate(form, resultId) {
  const fields = [...form.querySelectorAll("input")];
  fields.forEach(input => input.removeAttribute("aria-invalid"));
  const invalid = fields.filter(input => !input.validity.valid || !Number.isFinite(input.valueAsNumber));
  if (invalid.length) {
    error(resultId, resultId === "required-result"
      ? "点数は0〜100点、割合は0〜100%の数値をすべての欄に入力してください。"
      : "すべての欄に範囲内の数値を入力してください。回数は0〜10,000の整数（総授業回数は1以上）、割合・成績は0〜100、その他の点数は0〜10,000です。", invalid.map(input => input.id));
    invalid[0].focus();
    return false;
  }
  return true;
}

function attendance() {
  const total = read("total"), held = read("held"), absent = read("absent"), rate = read("rate");
  if (held > total) return error("attendance-result", "現在までの授業回数は、総授業回数以下にしてください。", ["held"]);
  if (absent > held) return error("attendance-result", "欠席回数は、現在までの授業回数以下にしてください。", ["absent"]);
  const required = Math.ceil(clean(total * rate / 100));
  const allowed = total - required;
  const remaining = total - held;
  // 欠席上限だけでなく、実際に残っている授業回数も上限にする。
  const extra = Math.min(allowed - absent, remaining);
  const current = held === 0 ? "未実施" : `${format((held - absent) / held * 100)}%`;
  const info = `現在の出席率：${current}<br>必要出席：${required} / ${total}回 ・ 残り授業：${remaining}回`;
  if (extra < 0) {
    show("attendance-result", "danger", "出席条件を満たせない見込みです", "0", "回", `${info}<br>残りすべてに出席しても条件に届きません。担当教員に確認しましょう。`, "危険");
  } else if (remaining === 0) {
    show("attendance-result", "", "すべての授業が終了しました", "0", "回", `${info}<br>出席条件を満たしています。`, "達成");
  } else {
    const tight = extra <= 1;
    show("attendance-result", tight ? "warning" : "", "最終的にあと欠席できる回数", format(extra), "回", `${info}<br>${extra === 0 ? "これ以上欠席すると出席条件を満たせません。" : tight ? "欠席できる余裕はあと1回。出席を大切に。" : "出席条件に余裕があります。この調子で！"}`, tight ? "注意" : "安全");
  }
}

function requiredScore() {
  const weightIds = ["required-assignment-weight", "required-midterm-weight", "required-final-weight"];
  const [assignmentWeight, midtermWeight, finalWeight] = weightIds.map(read);
  const weight = clean(assignmentWeight + midtermWeight + finalWeight);
  if (weight !== 100) return error("required-result", `成績割合の合計を100%にしてください。現在${format(weight)}%です。`, weightIds);

  // 確定済みの点数に割合を掛け、残りの成績を期末の100点満点に換算する。
  const earned = clean((read("required-assignment-score") * assignmentWeight
    + read("required-midterm-score") * midtermWeight) / 100);
  const needed = Math.max(0, clean(read("pass") - earned));
  // 期末割合が0%の場合はゼロ除算せず、到達済みか取得不可能かを表示。
  const examScore = needed === 0 ? 0 : finalWeight === 0 ? null : clean(needed / (finalWeight / 100));
  let state = "", message;
  if (needed === 0) {
    message = "点数上はすでに合格ラインに到達しています";
  } else if (examScore === null || examScore > 100) {
    state = "danger";
    message = "期末試験で満点を取っても合格ラインに届きません";
  } else if (examScore >= 80) {
    state = "warning";
    message = "かなり高い点数が必要です";
  } else if (examScore >= 60) {
    state = "warning";
    message = "やや高い点数が必要です";
  } else {
    message = "十分に到達可能です";
  }
  const result = document.getElementById("required-result");
  result.className = `result ${state}`;
  result.innerHTML = `
    <dl class="required-summary">
      <div><dt>現在確定している成績</dt><dd>${format(earned)} <small>/ 100点</small></dd></div>
      <div><dt>合格まで</dt><dd>あと${format(needed)}<small>点</small></dd></div>
    </dl>
    <p class="result-label">期末試験で最低必要な点数</p>
    <p class="result-value">${examScore === null ? "—" : format(examScore)}<small>${examScore === null ? "算出不可" : "点以上必要"}</small></p>
    <p class="result-detail">期末試験で必要な得点率：${examScore === null ? "算出不可（期末の割合が0%）" : `${format(examScore)}%`}</p>
    <p class="result-detail required-message">${message}</p>`;
}

function finalGrade() {
  const items = ["assignment", "midterm", "final"];
  const weight = clean(items.reduce((sum, item) => sum + read(`${item}-weight`), 0));
  if (weight !== 100) return error("grade-result", `割合の合計は現在${format(weight)}%です。合計100%にしてください。`, items.map(item => `${item}-weight`));
  const score = clean(items.reduce((sum, item) => sum + read(`${item}-score`) * read(`${item}-weight`) / 100, 0));
  const grade = score >= 90 ? "S" : score >= 80 ? "A" : score >= 70 ? "B" : score >= 60 ? "C" : "不可";
  show("grade-result", score < 60 ? "danger" : score < 70 ? "warning" : "", "予測される最終成績", format(score), "/ 100点", score < 60 ? "合格目安の60点まで、あと" + format(60 - score) + "点です。" : "合格目安の60点を満たしています。<br>学校・授業ごとの評価基準も確認しましょう。", `評価 ${grade}`);
}

// 初期値で例を表示。編集後は前の結果を消して、再計算を促す。
[["attendance", attendance], ["required", requiredScore], ["grade", finalGrade]].forEach(([name, calculate]) => {
  const form = document.getElementById(`${name}-form`);
  const resultId = `${name}-result`;
  form.addEventListener("submit", event => {
    event.preventDefault();
    if (validate(form, resultId)) calculate();
  });
  form.addEventListener("input", event => {
    event.target.removeAttribute("aria-invalid");
    show(resultId, "neutral", "入力内容が変更されました", "—", "", "上のボタンを押して、最新の結果を確認してください。");
  });
  calculate();
});
