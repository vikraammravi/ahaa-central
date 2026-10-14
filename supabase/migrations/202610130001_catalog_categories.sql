-- Category is a text field; new options are maintained centrally in the app.
update public.catalog_items set category='Desserts' where lower(trim(category))='sweet';
