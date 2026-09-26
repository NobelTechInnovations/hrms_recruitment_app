"use client";

import { updateCompanyProfileAction } from "@/actions/company";
import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { CheckboxField, Input, Select, Textarea } from "@/components/ui";
import { COMPANY_SIZES, INDUSTRIES } from "@/lib/constants";

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="grid gap-4 border-t border-line pt-5 first:border-0 first:pt-0 sm:grid-cols-2">
      <legend className="mb-1 font-medium text-ink sm:col-span-2">{title}</legend>
      {children}
    </fieldset>
  );
}

export function CompanyProfileForm({ d }: { d: { [key: string]: string | boolean; gstApplicable: boolean } }) {
  const v = (k: string) => String(d[k] ?? "");
  return (
    <ActionForm action={updateCompanyProfileAction} className="space-y-6">
      <Group title="Organisation">
        <Field name="name" label="Company / organisation name">
          <Input id="name" name="name" defaultValue={v("name")} />
        </Field>
        <Field name="legalName" label="Registered legal name" optional>
          <Input id="legalName" name="legalName" defaultValue={v("legalName")} />
        </Field>
        <Field name="industry" label="Industry">
          <Select id="industry" name="industry" defaultValue={v("industry")} options={INDUSTRIES} placeholder="Select" />
        </Field>
        <Field name="size" label="Company size">
          <Select id="size" name="size" defaultValue={v("size")} options={COMPANY_SIZES} placeholder="Select" />
        </Field>
        <Field name="website" label="Official website">
          <Input id="website" name="website" defaultValue={v("website")} />
        </Field>
        <Field name="businessEmail" label="Business email" hint="Candidate replies are delivered here; candidates only see your relay address.">
          <Input id="businessEmail" name="businessEmail" type="email" defaultValue={v("businessEmail")} />
        </Field>
        <Field name="description" label="About the company" optional className="sm:col-span-2">
          <Textarea id="description" name="description" defaultValue={v("description")} rows={3} />
        </Field>
      </Group>
      <Group title="Registration & tax">
        <Field name="registrationNumber" label="Registration number (CIN / LLPIN / Udyam)">
          <Input id="registrationNumber" name="registrationNumber" defaultValue={v("registrationNumber")} />
        </Field>
        <Field name="pan" label="PAN / business identification">
          <Input id="pan" name="pan" defaultValue={v("pan")} placeholder="AABCX1234F" className="uppercase" />
        </Field>
        <div className="sm:col-span-2">
          <CheckboxField name="gstApplicable" defaultChecked={d.gstApplicable} label="GST registration applies to us" description="Untick only if your organisation is exempt from GST registration." />
        </div>
        <Field name="gstNumber" label="GSTIN" optional>
          <Input id="gstNumber" name="gstNumber" defaultValue={v("gstNumber")} placeholder="29AABCX1234F1Z5" className="uppercase" />
        </Field>
      </Group>
      <Group title="Address">
        <Field name="addressLine" label="Address" className="sm:col-span-2">
          <Input id="addressLine" name="addressLine" defaultValue={v("addressLine")} />
        </Field>
        <Field name="city" label="City">
          <Input id="city" name="city" defaultValue={v("city")} />
        </Field>
        <Field name="state" label="State">
          <Input id="state" name="state" defaultValue={v("state")} />
        </Field>
        <Field name="pincode" label="PIN code">
          <Input id="pincode" name="pincode" defaultValue={v("pincode")} inputMode="numeric" />
        </Field>
      </Group>
      <Group title="Contact person">
        <Field name="contactName" label="Name">
          <Input id="contactName" name="contactName" defaultValue={v("contactName")} />
        </Field>
        <Field name="contactDesignation" label="Designation" optional>
          <Input id="contactDesignation" name="contactDesignation" defaultValue={v("contactDesignation")} />
        </Field>
        <Field name="contactPhone" label="Phone">
          <Input id="contactPhone" name="contactPhone" type="tel" defaultValue={v("contactPhone")} />
        </Field>
        <Field name="contactEmail" label="Email" optional>
          <Input id="contactEmail" name="contactEmail" type="email" defaultValue={v("contactEmail")} />
        </Field>
      </Group>
      <Group title="Hiring requirements">
        <Field name="hiringRequirements" label="What roles are you hiring for?" className="sm:col-span-2">
          <Textarea id="hiringRequirements" name="hiringRequirements" defaultValue={v("hiringRequirements")} rows={3} />
        </Field>
      </Group>
      <Group title="Payment / billing details">
        <Field name="billingName" label="Billing name">
          <Input id="billingName" name="billingName" defaultValue={v("billingName")} />
        </Field>
        <Field name="billingEmail" label="Billing email">
          <Input id="billingEmail" name="billingEmail" type="email" defaultValue={v("billingEmail")} />
        </Field>
        <Field name="billingAddress" label="Billing address" className="sm:col-span-2">
          <Input id="billingAddress" name="billingAddress" defaultValue={v("billingAddress")} />
        </Field>
        <Field name="billingGstNumber" label="Billing GSTIN" optional>
          <Input id="billingGstNumber" name="billingGstNumber" defaultValue={v("billingGstNumber")} />
        </Field>
      </Group>
      <div className="flex justify-end border-t border-line pt-4">
        <SubmitButton>Save company profile</SubmitButton>
      </div>
    </ActionForm>
  );
}
