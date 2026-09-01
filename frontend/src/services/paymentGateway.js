export function continueToPaymentGateway(payment) {
  const url = payment?.payment_url || payment?.redirect_url;
  if (!url) throw new Error("Gateway did not return a checkout URL.");

  if (payment?.method === "post" && payment?.form_fields) {
    const form = document.createElement("form");
    form.method = "POST";
    form.action = url;
    form.style.display = "none";

    Object.entries(payment.form_fields).forEach(([name, value]) => {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = name;
      input.value = String(value ?? "");
      form.appendChild(input);
    });

    document.body.appendChild(form);
    form.submit();
    return;
  }

  window.location.assign(url);
}
