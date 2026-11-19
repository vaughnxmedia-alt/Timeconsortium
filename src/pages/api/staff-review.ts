export const prerender = false;

import type { APIRoute } from "astro";
import {
  acceptVendor,
  createAccessLink,
  emailConfigured,
  isStaff,
  recordPayment,
  rememberError,
  rememberLink,
  updateVendor,
} from "../../lib/vendor/server";

function text(form: FormData, name: string, max: number) {
  return String(form.get(name) ?? "").trim().slice(0, max);
}

export const POST: APIRoute = async ({ request, cookies, redirect, url }) => {
  if (!(await isStaff(cookies))) return redirect("/staff/vendors");
  const form = await request.formData().catch(() => null);
  if (!form) return redirect("/staff/vendors");
  const id = text(form, "id", 40);
  const intent = text(form, "intent", 40);
  const back = `/staff/vendors/${id}`;

  if (intent === "notes") {
    const error = await updateVendor(id, (record) => {
      record.staffNotes = text(form, "staffNotes", 4000);
    });
    if (error) rememberError(cookies, error);
    return redirect(back);
  }

  if (intent === "review") {
    const error = await updateVendor(id, (record) => {
      if (record.status !== "submitted" && record.status !== "under_review") {
        return "Only a new request can be marked under review.";
      }
      record.status = "under_review";
    });
    if (error) rememberError(cookies, error);
    return redirect(back);
  }

  if (intent === "decline") {
    const error = await updateVendor(id, (record) => {
      if (record.status === "confirmed") return "A confirmed vendor is not declined from this queue.";
      record.status = "declined";
    });
    if (error) rememberError(cookies, error);
    return redirect(back);
  }

  if (intent === "payment") {
    const error = await recordPayment(id);
    if (error) rememberError(cookies, error);
    return redirect(back);
  }

  if (intent === "link") {
    const issued = await createAccessLink(id, url.origin);
    if ("error" in issued) rememberError(cookies, issued.error);
    else {
      rememberLink(cookies, issued.link);
      if (!issued.emailed && emailConfigured()) {
        rememberError(cookies, "The access link was created, but the email was not delivered.");
      }
    }
    return redirect(back);
  }

  if (intent === "accept") {
    const result = await acceptVendor(
      id,
      {
        included: text(form, "included", 1200),
        feeRequired: form.get("feeRequired") === "yes",
        feeLabel: text(form, "feeLabel", 120),
        confirmationDeadline: text(form, "confirmationDeadline", 120),
        checkoutUrl: text(form, "checkoutUrl", 400),
      },
      url.origin,
    );
    if ("error" in result) rememberError(cookies, result.error);
    else {
      rememberLink(cookies, result.link);
      if (!result.emailed && emailConfigured()) {
        rememberError(cookies, "The access link was created, but the acceptance email was not delivered.");
      }
    }
    return redirect(back);
  }

  if (intent === "publish") {
    const error = await updateVendor(id, (record) => {
      if (record.status !== "confirmed") {
        return "Publish a vendor only after confirmation is complete.";
      }
      const publicName = text(form, "publicName", 160) || record.businessName;
      const publicSpecialty = text(form, "publicSpecialty", 160) || record.specialty;
      const publicSummary = text(form, "publicSummary", 280);
      const publicPortfolio = text(form, "publicPortfolio", 400) || record.portfolio;
      const publicLogoUrl = text(form, "publicLogoUrl", 400);
      if (!publicSummary) {
        return "Add a short public description before publishing.";
      }
      if (publicPortfolio && !/^https?:\/\//i.test(publicPortfolio)) {
        return "The public portfolio link must start with http:// or https://.";
      }
      if (publicLogoUrl && !/^https:\/\//i.test(publicLogoUrl) && !publicLogoUrl.startsWith("/")) {
        return "Use an https logo link, or leave the logo blank until it is ready.";
      }
      record.publicName = publicName;
      record.publicSpecialty = publicSpecialty;
      record.publicSummary = publicSummary;
      record.publicPortfolio = publicPortfolio;
      record.publicLogoUrl = publicLogoUrl;
      record.published = form.get("published") === "yes";
    });
    if (error) rememberError(cookies, error);
    return redirect(back);
  }

  rememberError(cookies, "That review action was not saved.");
  return redirect(id ? back : "/staff/vendors");
};
