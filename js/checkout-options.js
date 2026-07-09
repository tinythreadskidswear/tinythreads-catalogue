(function () {
  const TT_WA_NUMBER = "917879976016";

  function getBasketItems() {
    if (typeof window.getBasketItems === "function") {
      const items = window.getBasketItems();
      return Array.isArray(items) ? items : [];
    }

    return Array.isArray(window.basket) ? window.basket : [];
  }

  function getBasketSubtotal() {
    return getBasketItems().reduce(function (sum, item) {
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
    return "\u20B9" + Number(value || 0).toLocaleString("en-IN");
  }

  function openCheckoutImageOptions() {
    if (!getBasketItems().length) {
      if (typeof window.showToast === "function") {
        window.showToast("Your basket is empty.");
      }
      return;
    }

    if (typeof window.closeCheckoutTray === "function") {
      window.closeCheckoutTray();
    }

    const overlay = document.getElementById("ttcioOverlay");
    if (!overlay) return;

    overlay.classList.add("open");
    document.body.style.overflow = "hidden";
  }

  function closeCheckoutImageOptions() {
    const overlay = document.getElementById("ttcioOverlay");
    if (!overlay) return;

    overlay.classList.remove("open");

    const basketOpen =
      document.getElementById("basket-drawer") &&
      document.getElementById("basket-drawer").classList.contains("open");

    const shipOpen =
      document.getElementById("shipOverlay") &&
      document.getElementById("shipOverlay").classList.contains("active");

    document.body.style.overflow = basketOpen || shipOpen ? "hidden" : "";
  }

  function ttCheckoutImageOverlayClick(event) {
    if (event.target && event.target.id === "ttcioOverlay") {
      closeCheckoutImageOptions();
    }
  }

  function buildCartMessage(type) {
    const items = getBasketItems();
    const subtotal = getBasketSubtotal();
    const discount = getBasketDiscount(subtotal);
    const total = subtotal - discount;

    let intro = "Hi Tinythreads, I would like help with my cart.";

    if (type === "home_trial") {
      intro = "Hi Tinythreads, I would like to book a Home Trial for my cart.";
    }

    if (type === "walkin") {
      intro = "Hi Tinythreads, I would like to reserve these items for Walk-In & Collect.";
    }

    const lines = [intro, "", "Cart items:"];

    items.forEach(function (item, index) {
      const name = item.name || "Product";
      const qty = Number(item.qty) || 1;
      const size = item.size ? " | Size: " + item.size : "";
      const price = Number(item.price) || 0;
      const lineTotal = qty * price;

      lines.push(
        (index + 1) + ". " + name + size + " | Qty: " + qty + " | " + formatMoney(lineTotal)
      );
    });

    lines.push("");
    lines.push("Subtotal: " + formatMoney(subtotal));

    if (discount > 0) {
      lines.push("Discount: -" + formatMoney(discount));
    }

    lines.push("Total: " + formatMoney(total));

    if (window.appliedPromo && window.appliedPromo.code) {
      lines.push("Promo code: " + window.appliedPromo.code);
    }

    if (type === "home_trial") {
      lines.push("");
      lines.push("Please confirm the available Home Trial slot and applicable convenience fee.");
    }

    if (type === "walkin") {
      lines.push("");
      lines.push("Please confirm the nearest outlet and suitable pickup time.");
    }

    return lines.join("\n");
  }

  function openWhatsAppMessage(type) {
    const message = buildCartMessage(type);
    const url = "https://wa.me/" + TT_WA_NUMBER + "?text=" + encodeURIComponent(message);
    window.open(url, "_blank");
  }

  function selectCheckoutImageOption(method) {
    closeCheckoutImageOptions();

    if (method === "whatsapp") {
      if (typeof window.checkoutWhatsApp === "function") {
        window.checkoutWhatsApp();
      } else if (typeof window.openShipModal === "function") {
        window.openShipModal();
      }
      return;
    }

    if (method === "home_trial") {
      openWhatsAppMessage("home_trial");
      return;
    }

    if (method === "walkin") {
      openWhatsAppMessage("walkin");
    }
  }

  function bindCheckoutImageTriggers() {
    const stickyBar = document.getElementById("basket-sticky-bar");
    if (stickyBar) {
      stickyBar.onclick = openCheckoutImageOptions;
    }

    const checkoutBtn = document.getElementById("checkout-btn");
    if (checkoutBtn) {
      checkoutBtn.onclick = function (event) {
        event.preventDefault();
        openCheckoutImageOptions();
      };
    }
  }

  document.addEventListener("DOMContentLoaded", bindCheckoutImageTriggers);

  document.addEventListener("keydown", function (event) {
    const overlay = document.getElementById("ttcioOverlay");
    if (event.key === "Escape" && overlay && overlay.classList.contains("open")) {
      closeCheckoutImageOptions();
    }
  });

  window.openCheckoutImageOptions = openCheckoutImageOptions;
  window.closeCheckoutImageOptions = closeCheckoutImageOptions;
  window.ttCheckoutImageOverlayClick = ttCheckoutImageOverlayClick;
  window.selectCheckoutImageOption = selectCheckoutImageOption;
})();
