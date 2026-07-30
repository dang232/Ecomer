import { Filter, Package, Search, SlidersHorizontal } from "lucide-react";
import { useState } from "react";

import {
  CampaignMedia,
  HorizontalRail,
  ProductGrid,
  ProductTile,
  TrustCues,
  type ProductTileView,
} from "@/shared/commerce";
import {
  AsyncState,
  Button,
  Checkbox,
  DataTable,
  Dialog,
  Drawer,
  Field,
  IconButton,
  InlineAlert,
  PageContainer,
  PageHeader,
  Pagination,
  Progress,
  SegmentedControl,
  Skeleton,
  StatusIndicator,
  Switch,
  TableToolbar,
  Tabs,
  Tooltip,
} from "@/shared/ui";
import type { DataTableColumn } from "@/shared/ui";

interface DemoOrder {
  id: string;
  customer: string;
  status: string;
  total: string;
}

const orders: DemoOrder[] = [
  { id: "VN-20418", customer: "Nguyen Thi Mai", status: "Paid", total: "1,250,000 VND" },
  { id: "VN-20419", customer: "Alexandra Villanueva", status: "Packing", total: "840,000 VND" },
];

const columns: DataTableColumn<DemoOrder>[] = [
  { id: "order", header: "Order", cell: (order) => order.id },
  {
    id: "customer",
    header: "Customer",
    cell: (order) => order.customer,
    priority: "secondary",
  },
  {
    id: "status",
    header: "Status",
    cell: (order) => <StatusIndicator tone="info">{order.status}</StatusIndicator>,
    priority: "secondary",
  },
  {
    id: "total",
    header: "Total",
    cell: (order) => order.total,
    priority: "tertiary",
    align: "end",
  },
];

const commerceProducts: ProductTileView[] = [
  {
    id: "trail-runner",
    name: "VNShop Trail Runner for city commutes and weekend routes",
    imageUrl: "/images/marketplace-collection.png",
    priceVnd: 1_250_000,
    originalPriceVnd: 1_500_000,
    rating: 4.8,
    soldCount: 2_300,
    sellerName: "VNShop Mall",
    stockState: "in-stock",
  },
  {
    id: "long-label",
    name: "A 120 character Vietnamese product title that keeps the product tile height stable even with unavailable stock and no rating",
    priceVnd: 12_500_000,
    sellerName: "Verified home store with an intentionally long seller name",
    stockState: "unavailable",
  },
  {
    id: "coffee-kit",
    name: "Vietnamese coffee starter kit",
    imageUrl: "/images/marketplace-collection.png",
    priceVnd: 480_000,
    originalPriceVnd: 600_000,
    rating: 4.5,
    soldCount: 912,
    sellerName: "Saigon Pantry",
    stockState: "low-stock",
  },
];

const trustCues = [
  { id: "buyer-protection", label: "Buyer protection", detail: "Payment held safely" },
  { id: "returns", label: "Easy returns", detail: "Simple return flow" },
  { id: "shipping", label: "Tracked delivery", detail: "Updates from pickup" },
] as const;

function DemoSurface({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 border-y border-border py-6 sm:grid-cols-2">{children}</div>;
}

export function DesignSystemPage() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [tab, setTab] = useState("orders");
  const [segment, setSegment] = useState("week");
  const [page, setPage] = useState(1);

  return (
    <PageContainer density="compact" className="space-y-10">
      <PageHeader title="Commerce UI" description="Shared buyer, seller, and admin controls." />

      <section aria-labelledby="actions-heading" className="space-y-4">
        <h2 id="actions-heading" className="text-lg font-bold text-foreground">
          Actions
        </h2>
        <DemoSurface>
          <div className="flex flex-wrap items-center gap-3">
            <Button>Continue to checkout</Button>
            <Button variant="accent">Flash sale</Button>
            <Button variant="outline">Save draft</Button>
            <Button pending pendingLabel="Saving order">
              Save order
            </Button>
            <Button disabled>Disabled</Button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Tooltip label="Filter products">
              <IconButton label="Filter products">
                <Filter />
              </IconButton>
            </Tooltip>
            <Tooltip label="Search products">
              <IconButton label="Search products">
                <Search />
              </IconButton>
            </Tooltip>
            <Tooltip label="Adjust order view">
              <IconButton label="Adjust order view" disabled>
                <SlidersHorizontal />
              </IconButton>
            </Tooltip>
          </div>
        </DemoSurface>
      </section>

      <section aria-labelledby="inputs-heading" className="space-y-4">
        <h2 id="inputs-heading" className="text-lg font-bold text-foreground">
          Inputs
        </h2>
        <DemoSurface>
          <div className="grid gap-4">
            <Field id="demo-store" label="Store name" defaultValue="VNShop Official" />
            <Checkbox label="Apply this campaign price to all variants" />
            <Switch label="Notify buyers when stock is available" defaultChecked />
          </div>
          <div className="grid content-start gap-4">
            <SegmentedControl
              ariaLabel="Sales interval"
              value={segment}
              onValueChange={setSegment}
              items={[
                { value: "day", label: "Day" },
                { value: "week", label: "Week" },
                { value: "month", label: "Month" },
              ]}
            />
            <Tabs
              ariaLabel="Order queues"
              value={tab}
              onValueChange={setTab}
              items={[
                { value: "orders", label: "Orders" },
                { value: "returns", label: "Returns" },
                { value: "disputes", label: "Disputes" },
              ]}
            />
          </div>
        </DemoSurface>
      </section>

      <section aria-labelledby="operations-heading" className="space-y-4">
        <h2 id="operations-heading" className="text-lg font-bold text-foreground">
          Operations
        </h2>
        <TableToolbar ariaLabel="Order tools">
          <span className="text-sm font-semibold text-foreground">Recent orders</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              Export
            </Button>
            <Button size="sm" onClick={() => setDrawerOpen(true)}>
              Open details
            </Button>
          </div>
        </TableToolbar>
        <DataTable
          caption="Recent seller orders"
          rows={orders}
          columns={columns}
          rowKey={(order) => order.id}
          selectedId="VN-20418"
          onRowOpen={() => setDrawerOpen(true)}
          empty="No orders"
        />
        <Pagination page={page} pageCount={3} onPageChange={setPage} />
      </section>

      <section aria-labelledby="feedback-heading" className="space-y-4">
        <h2 id="feedback-heading" className="text-lg font-bold text-foreground">
          Feedback
        </h2>
        <DemoSurface>
          <div className="grid gap-3">
            <InlineAlert title="Inventory updated">
              Twelve variants are ready to publish.
            </InlineAlert>
            <InlineAlert tone="warning" title="Shipping label required">
              Add a carrier label before pickup.
            </InlineAlert>
            <InlineAlert tone="danger" title="Payment needs review">
              The card authorization could not be confirmed.
            </InlineAlert>
          </div>
          <div className="grid content-start gap-4">
            <Progress label="Upload progress" value={68} />
            <div className="flex items-center gap-3">
              <Skeleton className="h-11 w-11" />
              <div className="grid flex-1 gap-2">
                <Skeleton className="h-3 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
            <AsyncState
              status="partial"
              loading={<span>Loading orders</span>}
              empty={<span>No orders</span>}
              error={<span>Orders unavailable</span>}
              partial={
                <span className="text-sm text-muted-foreground">Showing available order data.</span>
              }
            >
              <span>Orders ready</span>
            </AsyncState>
          </div>
        </DemoSurface>
      </section>

      <section aria-labelledby="commerce-patterns-heading" className="space-y-6">
        <h2 id="commerce-patterns-heading" className="text-lg font-bold text-foreground">
          Marketplace patterns
        </h2>
        <CampaignMedia
          eyebrow="Weekend edit"
          title="Useful things for the way you shop"
          description="A calm, practical collection for everyday delivery."
          actionLabel="Explore the edit"
          href="/search?q=weekend"
          imageUrl="/images/marketplace-collection.png"
          imageAlt="Everyday products arranged on a sunlit workspace"
        />
        <HorizontalRail title="Popular with buyers">
          {commerceProducts.map((product) => (
            <div key={product.id} className="snap-start">
              <ProductTile product={product} href={`/product/${product.id}`} />
            </div>
          ))}
        </HorizontalRail>
        <ProductGrid products={commerceProducts} />
        <TrustCues cues={trustCues} />
      </section>

      <section aria-labelledby="themes-heading" className="space-y-4">
        <h2 id="themes-heading" className="text-lg font-bold text-foreground">
          Theme and scale
        </h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="max-w-[390px] border border-border p-4">
            <p className="text-sm font-semibold text-foreground">
              Giao hang nhanh cho don hang dac biet
            </p>
            <Button className="mt-4">Buy now</Button>
          </div>
          <div className="dark border border-border bg-background p-4" style={{ fontSize: "200%" }}>
            <p className="font-semibold text-foreground">Long English seller fulfillment label</p>
            <Button className="mt-4">Review</Button>
          </div>
        </div>
      </section>

      <Drawer
        open={drawerOpen}
        title="Order VN-20418"
        description="Buyer and fulfillment details"
        onOpenChange={setDrawerOpen}
        footer={<Button onClick={() => setDrawerOpen(false)}>Mark packed</Button>}
      >
        <div className="grid gap-4 text-sm">
          <div className="flex items-center gap-3">
            <Package className="h-5 w-5 text-primary" aria-hidden="true" />
            <span>Two items ready for pickup.</span>
          </div>
          <Button variant="outline" onClick={() => setDialogOpen(true)}>
            Confirm handoff
          </Button>
        </div>
      </Drawer>

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title="Confirm handoff"
        footer={<Button onClick={() => setDialogOpen(false)}>Confirm</Button>}
      >
        <p className="text-sm text-muted-foreground">
          The carrier will receive this order at the next pickup.
        </p>
      </Dialog>
    </PageContainer>
  );
}
