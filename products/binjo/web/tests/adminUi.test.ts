import assert from "node:assert/strict";
import test from "node:test";
import { adminNavKeyForPath } from "../lib/adminNavigation";
import {
  countOrdersByQueue,
  orderMatchesQueue,
  orderMatchesSearch,
} from "../lib/adminOrderPresentation";

test("admin navigation keeps legacy content pages inside the homepage area", () => {
  assert.equal(adminNavKeyForPath("/admin"), "today");
  assert.equal(adminNavKeyForPath("/admin/orders"), "orders");
  assert.equal(adminNavKeyForPath("/admin/products"), "products");
  assert.equal(adminNavKeyForPath("/admin/site"), "site");
  assert.equal(adminNavKeyForPath("/admin/farm"), "site");
  assert.equal(adminNavKeyForPath("/admin/gallery"), "site");
  assert.equal(adminNavKeyForPath("/admin/analytics"), "site");
});

test("order queue groups statuses by the next operator task", () => {
  const counts = countOrdersByQueue([
    { status: "inquiry" },
    { status: "paid" },
    { status: "confirmed" },
    { status: "shipped" },
    { status: "delivered" },
    { status: "cancelled" },
  ]);

  assert.equal(counts.action, 3);
  assert.equal(counts.shipped, 1);
  assert.equal(counts.delivered, 1);
  assert.equal(counts.cancelled, 1);
  assert.equal(counts.all, 6);
  assert.equal(orderMatchesQueue("confirmed", "action"), true);
  assert.equal(orderMatchesQueue("delivered", "action"), false);
});

test("order search ignores phone punctuation and searches key fulfillment fields", () => {
  const order = {
    customer_name: "김사과",
    customer_phone: "010-1234-5678",
    product_name: "시나노골드",
    tracking_number: "1234 5678",
  };

  assert.equal(orderMatchesSearch(order, "01012345678"), true);
  assert.equal(orderMatchesSearch(order, "시나노"), true);
  assert.equal(orderMatchesSearch(order, "12345678"), true);
  assert.equal(orderMatchesSearch(order, "없는고객"), false);
});

