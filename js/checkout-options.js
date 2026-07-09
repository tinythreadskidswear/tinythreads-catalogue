(function () {
  const TT_WA_NUMBER = "917879976016";

  function getBasketItems() {
    if (typeof window.getBasketItems === "function") {
      const items = window.getBasketItems();
      return Array.isArray(items) ? items : [];
    }

    return Array.isArray(window.basket) ? window.basket : [];
  }

  function getBasketCount() {
    return getBasketItems().reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
  }

  function getBasketSubtotal() {
    return getBasketItems().reduce((sum, item) => {
      return sum + ((Number(item.qty) || 0) * (Number(item.price) || 0));
    }, 0);
  }

  function getBasketDiscount(subtotal) {
    if (typeof window.calcDiscount === "function") {
      return Number(window.calcDiscount(subtotal)) || 0;
    }
    return 0;
  }

  function formatMoney(value) {
    return "₹" + Number(value || 0).toLocaleString("en-IN");
  }

  function updateCheckoutOptionsSummary() {
    const items = getBasketCount();
    const subtotal = getBasketSubtotal();
    const discount = getBasketDiscount(subtotal);
    const total = subtotal - discount;

    const summaryEl = document.getElementById("ttcoSummary");
    if (!summaryEl) return;

    summaryEl.textContent =
      `${items} item${items !== 1 ? "s" : ""} · Total ${formatMoney(total)}`;
  }

  function openCheckoutOptions() {
    const items = getBasketItems();

    if (!items.length) {
      if (typeof window.showToast === "function") {
        window.showToast("Your basket is empty.");
      }
      return;
    }

    updateCheckoutOptionsSummary();

    const overlay = document.getElementById("ttcoOverlay");
    if (!overlay) return;

    overlay.classList.add("open");
    document.body.style.overflow = "hidden";
  }

  function closeCheckoutOptions() {
    const overlay = document.getElementById("ttcoOverlay");
    if (!overlay) return;

    overlay.classList.remove("open");

    const basketOpen =
      document.getElementById("basket-drawer") &&
      document.getElementById("basket-drawer").classList.contains("open");

    const shipOpen =
      document.getElementById("shipOverlay") &&
      document.getElementById("shipOverlay").classList.contains("active");

    document.body.style.overflow = (basketOpen || shipOpen) ? "hidden" : "";
  }

  function ttCheckoutOverlayClick(e) {
    if (e.target && e.target.id === "ttcoOverlay") {
      closeCheckoutOptions();
    }
  }

  function buildCartMessage(type) {
    const items = getBasketItems();
    const subtotal = getBasketSubtotal();
    const discount = getBasketDiscount(subtotal);
    const total = subtotal - discount;

    let intro = "Hi Tinythreads, I would like help with my cart.";
    if (type === "home_trial") {
      intro = "Hi Tinythreads, I would like to request a Home Trial for my cart.";
    }
    if (type === "walkin") {
      intro = "Hi Tinythreads, I would like to Reserve & Collect my cart items.";
    }

    const lines = [intro, "", "Cart items:"];

    if (items.length) {
      items.forEach((item, index) => {
        const name = item.name || "Product";
        const qty = Number(item.qty) || 1;
        const size = item.size ? ` | Size: ${item.size}` : "";
        const price = Number(item.price) || 0;
        const lineTotal = qty * price;

        lines.push(
          `${index + 1}. ${name}${size} | Qty: ${qty} | ${formatMoney(lineTotal)}`
        );
      });
    } else {
      lines.push("No items found.");
    }

    lines.push("");
    lines.push(`Subtotal: ${formatMoney(subtotal)}`);

    if (discount > 0) {
      lines.push(`Discount: -${formatMoney(discount)}`);
    }

    lines.push(`Total: ${formatMoney(total)}`);

    if (window.appliedPromo && window.appliedPromo.code) {
      lines.push(`Promo code: ${window.appliedPromo.code}`);
    }

    if (type === "home_trial") {
      lines.push("");
      lines.push("Please let me know the applicable convenience fee and available home trial slot.");
    }

    if (type === "walkin") {
      lines.push("");
      lines.push("Please reserve these items for me and share the nearest outlet / pickup timing.");
    }

    return lines.join("\n");
  }

  function openWhatsAppMessage(type) {
    const message = buildCartMessage(type);
    const url = `https://wa.me/${TT_WA_NUMBER}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank");
  }

  function selectCheckoutOption(method) {
    closeCheckoutOptions();

    if (method === "whatsapp") {
      if (typeof window.checkoutWhatsApp === "function") {
        window.checkoutWhatsApp();
        return;
      }

      if (typeof window.openShipModal === "function") {
        window.openShipModal();
        return;
      }

      openWhatsAppMessage("whatsapp");
      return;
    }

    if (method === "home_trial") {
      openWhatsAppMessage("home_trial");
      return;
    }

    if (method === "walkin") {
      openWhatsAppMessage("walkin");
      return;
    }
  }

  function bindCheckoutTriggers() {
    const stickyBar = document.getElementById("basket-sticky-bar");
    if (stickyBar) {
      stickyBar.onclick = openCheckoutOptions;
    }

    const checkoutBtn = document.getElementById("checkout-btn");
    if (checkoutBtn) {
      checkoutBtn.onclick = function (e) {
        e.preventDefault();
        openCheckoutOptions();
      };
    }
  }

  document.addEventListener("DOMContentLoaded", bindCheckoutTriggers);

  document.addEventListener("keydown", function (e) {
    const overlay = document.getElementById("ttcoOverlay");
    if (e.key === "Escape" && overlay && overlay.classList.contains("open")) {
      closeCheckoutOptions();
    }
  });

  window.openCheckoutOptions = openCheckoutOptions;
  window.closeCheckoutOptions = closeCheckoutOptions;
  window.selectCheckoutOption = selectCheckoutOption;
  window.ttCheckoutOverlayClick = ttCheckoutOverlayClick;
})();
