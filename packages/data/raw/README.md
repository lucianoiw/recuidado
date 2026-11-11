# Manual input: accredited pharmacies

The Ministério da Saúde publishes the addresses of pharmacies accredited by the
Farmácia Popular only as a Qlik panel, with no download API:

https://infoms.saude.gov.br/extensions/SEIDIGI_DEMAS_PFPB_ENDERECOS/index.html

To mark which pharmacies of the demo region are accredited:

1. Open the panel, filter UF = SP and Município = São Paulo.
2. Export the table to CSV (or Excel saved as CSV, UTF-8).
3. Save it here as `pfpb-pharmacies.csv`. Any column whose header contains "CNPJ" is used.
4. Run `pnpm fetch:pharmacies`. `fp_accredited` becomes true or false for each pharmacy.

Without this file `fp_accredited` stays `null` (unknown).
