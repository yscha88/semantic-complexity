# ham-R7_opus-4.6_B

<!-- meta
experiment_id: ham-R7
model_name: opus-4.6
model_id: claude-opus-4-6
group: B
prompt_sha256: 718a26f38c6adc28f245769b5e865dfbc99db337e2ab4e216550730478c1356d
code_sha256: c035b0eec8fe2094db366513f55d9842c74de63b9ea79fa10a33d832a2d85af0
repo: marshmallow-code/marshmallow
commit: dd20a8092a8b
file: src/marshmallow/schema.py
lines: 1-396
-->

## 프롬프트

Analyze the testing practices and behavioral preservation of the following code.
Identify which critical paths are tested and which are not.
If this code were refactored, what existing behavior could break without being caught?

Check the following areas:
- Test coverage of critical paths
- Characterization tests (golden tests)
- API contract tests
- Separation of structural vs behavioral changes

```python
    def __init__(cls, name, bases, attrs):
        super().__init__(name, bases, attrs)
        if name and cls.opts.register:
            class_registry.register(name, cls)
        cls._hooks = cls.resolve_hooks()

    def __init__(self, meta: type):
        self.fields = getattr(meta, "fields", ())
        if not isinstance(self.fields, (list, tuple)):
            raise ValueError("`fields` option must be a list or tuple.")
        self.exclude = getattr(meta, "exclude", ())
        if not isinstance(self.exclude, (list, tuple)):
            raise ValueError("`exclude` must be a list or tuple.")
        self.dateformat = getattr(meta, "dateformat", None)
        self.datetimeformat = getattr(meta, "datetimeformat", None)
        self.timeformat = getattr(meta, "timeformat", None)
        self.render_module = getattr(meta, "render_module", json)
        self.index_errors = getattr(meta, "index_errors", True)
        self.include = getattr(meta, "include", {})
        self.load_only = getattr(meta, "load_only", ())
        self.dump_only = getattr(meta, "dump_only", ())
        self.unknown = getattr(meta, "unknown", RAISE)
        self.register = getattr(meta, "register", True)
        self.many = getattr(meta, "many", False)

    def __init__(
        self,
        *,
        only: types.StrSequenceOrSet | None = None,
        exclude: types.StrSequenceOrSet = (),
        many: bool | None = None,
        load_only: types.StrSequenceOrSet = (),
        dump_only: types.StrSequenceOrSet = (),
        partial: bool | types.StrSequenceOrSet | None = None,
        unknown: types.UnknownOption | None = None,
    ):
        # Raise error if only or exclude is passed as string, not list of strings
        if only is not None and not is_collection(only):
            raise StringNotCollectionError('"only" should be a list of strings')
        if not is_collection(exclude):
            raise StringNotCollectionError('"exclude" should be a list of strings')
        # copy declared fields from metaclass
        self.declared_fields = copy.deepcopy(self._declared_fields)
        self.many = self.opts.many if many is None else many
        self.only = only
        self.exclude: set[typing.Any] | typing.MutableSet[typing.Any] = set(
            self.opts.exclude
        ) | set(exclude)
        self.load_only = set(load_only) or set(self.opts.load_only)
        self.dump_only = set(dump_only) or set(self.opts.dump_only)
        self.partial = partial
        self.unknown: types.UnknownOption = (
            self.opts.unknown if unknown is None else unknown
        )
        self._normalize_nested_options()
        #: Dictionary mapping field_names -> :class:`Field` objects
        self.fields: dict[str, Field] = {}
        self.load_fields: dict[str, Field] = {}
        self.dump_fields: dict[str, Field] = {}
        self._init_fields()
        messages = {}
        messages.update(self._default_error_messages)
        for cls in reversed(self.__class__.__mro__):
            messages.update(getattr(cls, "error_messages", {}))
        messages.update(self.error_messages or {})
        self.error_messages = messages

    def _deserialize(
        self,
        data: Mapping[str, typing.Any] | Sequence[Mapping[str, typing.Any]],
        *,
        error_store: ErrorStore,
        many: bool = False,
        partial=None,
        unknown: types.UnknownOption = RAISE,
        index=None,
    ) -> typing.Any | list[typing.Any]:
        """Deserialize ``data``.

        :param data: The data to deserialize.
        :param error_store: Structure to store errors.
        :param many: `True` if ``data`` should be deserialized as a collection.
        :param partial: Whether to ignore missing fields and not require
            any fields declared. Propagates down to ``Nested`` fields as well. If
            its value is an iterable, only missing fields listed in that iterable
            will be ignored. Use dot delimiters to specify nested fields.
        :param unknown: Whether to exclude, include, or raise an error for unknown
            fields in the data. Use `EXCLUDE`, `INCLUDE` or `RAISE`.
        :param index: Index of the item being serialized (for storing errors) if
            serializing a collection, otherwise `None`.
        :return: The deserialized data as `dict_class` instance or list of `dict_class`
        instances if `many` is `True`.
        """
        index_errors = self.opts.index_errors
        index = index if index_errors else None
        if many:
            if not is_sequence_but_not_string(data):
                error_store.store_error([self.error_messages["type"]], index=index)
                ret_l = []
            else:
                ret_l = [
                    self._deserialize(
                        d,
                        error_store=error_store,
                        many=False,
                        partial=partial,
                        unknown=unknown,
                        index=idx,
                    )
                    for idx, d in enumerate(data)
                ]
            return ret_l
        ret_d = self.dict_class()
        # Check data is a dict
        if not isinstance(data, Mapping):
            error_store.store_error([self.error_messages["type"]], index=index)
        else:
            partial_is_collection = is_collection(partial)
            for attr_name, field_obj in self.load_fields.items():
                field_name = (
                    field_obj.data_key if field_obj.data_key is not None else attr_name
                )
                raw_value = data.get(field_name, missing)
                if raw_value is missing:
                    # Ignore missing field if we're allowed to.
                    if partial is True or (
                        partial_is_collection and attr_name in partial
                    ):
                        continue
                d_kwargs = {}
                # Allow partial loading of nested schemas.
                if partial_is_collection:
                    prefix = attr_name + "."
                    len_prefix = len(prefix)
                    sub_partial = [
                        f[len_prefix:] for f in partial if f.startswith(prefix)
                    ]
                    d_kwargs["partial"] = sub_partial
                elif partial is not None:
                    d_kwargs["partial"] = partial

                def getter(
                    val, field_obj=field_obj, field_name=field_name, d_kwargs=d_kwargs
                ):
                    return field_obj.deserialize(
                        val,
                        field_name,
                        data,
                        **d_kwargs,
                    )

                value = self._call_and_store(
                    getter_func=getter,
                    data=raw_value,
                    field_name=field_name,
                    error_store=error_store,
                    index=index,
                )
                if value is not missing:
                    key = field_obj.attribute or attr_name
                    set_value(ret_d, key, value)
            if unknown != EXCLUDE:
                fields = {
                    field_obj.data_key if field_obj.data_key is not None else field_name
                    for field_name, field_obj in self.load_fields.items()
                }
                for key in set(data) - fields:
                    value = data[key]
                    if unknown == INCLUDE:
                        ret_d[key] = value
                    elif unknown == RAISE:
                        error_store.store_error(
                            [self.error_messages["unknown"]],
                            key,
                            (index if index_errors else None),
                        )
        return ret_d

    def _run_validator(
        self,
        validator_func: types.SchemaValidator,
        output,
        *,
        original_data,
        error_store: ErrorStore,
        many: bool,
        partial: bool | types.StrSequenceOrSet | None,
        unknown: types.UnknownOption | None,
        pass_original: bool,
        index: int | None = None,
    ):
        try:
            if pass_original:  # Pass original, raw data (before unmarshalling)
                validator_func(
                    output, original_data, partial=partial, many=many, unknown=unknown
                )
            else:
                validator_func(output, partial=partial, many=many, unknown=unknown)
        except ValidationError as err:
            field_name = err.field_name
            data_key: str
            if field_name == SCHEMA:
                data_key = SCHEMA
            else:
                field_obj: Field | None = None
                try:
                    field_obj = self.fields[field_name]
                except KeyError:
                    if field_name in self.declared_fields:
                        field_obj = self.declared_fields[field_name]
                if field_obj:
                    data_key = (
                        field_obj.data_key
                        if field_obj.data_key is not None
                        else field_name
                    )
                else:
                    data_key = field_name
            error_store.store_error(err.messages, data_key, index=index)

    def _do_load(
        self,
        data: (Mapping[str, typing.Any] | Sequence[Mapping[str, typing.Any]]),
        *,
        many: bool | None = None,
        partial: bool | types.StrSequenceOrSet | None = None,
        unknown: types.UnknownOption | None = None,
        postprocess: bool = True,
    ):
        """Deserialize `data`, returning the deserialized result.
        This method is private API.

        :param data: The data to deserialize.
        :param many: Whether to deserialize `data` as a collection. If `None`, the
            value for `self.many` is used.
        :param partial: Whether to validate required fields. If its
            value is an iterable, only fields listed in that iterable will be
            ignored will be allowed missing. If `True`, all fields will be allowed missing.
            If `None`, the value for `self.partial` is used.
        :param unknown: Whether to exclude, include, or raise an error for unknown
            fields in the data. Use `EXCLUDE`, `INCLUDE` or `RAISE`.
            If `None`, the value for `self.unknown` is used.
        :param postprocess: Whether to run post_load methods..
        :return: Deserialized data
        """
        error_store = ErrorStore()
        errors: dict[str, list[str]] = {}
        many = self.many if many is None else bool(many)
        unknown = self.unknown if unknown is None else unknown
        if partial is None:
            partial = self.partial
        # Run preprocessors
        if self._hooks[PRE_LOAD]:
            try:
                processed_data = self._invoke_load_processors(
                    PRE_LOAD,
                    data,
                    many=many,
                    original_data=data,
                    partial=partial,
                    unknown=unknown,
                )
            except ValidationError as err:
                errors = err.normalized_messages()
                result: list | dict | None = None
        else:
            processed_data = data
        if not errors:
            # Deserialize data
            result = self._deserialize(
                processed_data,
                error_store=error_store,
                many=many,
                partial=partial,
                unknown=unknown,
            )
            # Run field-level validation
            self._invoke_field_validators(
                error_store=error_store, data=result, many=many
            )
            # Run schema-level validation
            if self._hooks[VALIDATES_SCHEMA]:
                field_errors = bool(error_store.errors)
                self._invoke_schema_validators(
                    error_store=error_store,
                    pass_collection=True,
                    data=result,
                    original_data=data,
                    many=many,
                    partial=partial,
                    unknown=unknown,
                    field_errors=field_errors,
                )
                self._invoke_schema_validators(
                    error_store=error_store,
                    pass_collection=False,
                    data=result,
                    original_data=data,
                    many=many,
                    partial=partial,
                    unknown=unknown,
                    field_errors=field_errors,
                )
            errors = error_store.errors
            # Run post processors
            if not errors and postprocess and self._hooks[POST_LOAD]:
                try:
                    result = self._invoke_load_processors(
                        POST_LOAD,
                        result,
                        many=many,
                        original_data=data,
                        partial=partial,
                        unknown=unknown,
                    )
                except ValidationError as err:
                    errors = err.normalized_messages()
        if errors:
            exc = ValidationError(errors, data=data, valid_data=result)
            self.handle_error(exc, data, many=many, partial=partial)
            raise exc

        return result

    def _init_fields(self) -> None:
        """Update self.fields, self.load_fields, and self.dump_fields based on schema options.
        This method is private API.
        """
        if self.opts.fields:
            available_field_names = self.set_class(self.opts.fields)
        else:
            available_field_names = self.set_class(self.declared_fields.keys())

        invalid_fields = self.set_class()

        if self.only is not None:
            # Return only fields specified in only option
            field_names: typing.AbstractSet[typing.Any] = self.set_class(self.only)

            invalid_fields |= field_names - available_field_names
        else:
            field_names = available_field_names

        # If "exclude" option or param is specified, remove those fields.
        if self.exclude:
            # Note that this isn't available_field_names, since we want to
            # apply "only" for the actual calculation.
            field_names = field_names - self.exclude
            invalid_fields |= self.exclude - available_field_names

        if invalid_fields:
            message = f"Invalid fields for {self}: {invalid_fields}."
            raise ValueError(message)

        fields_dict = self.dict_class()
        for field_name in field_names:
            field_obj = self.declared_fields[field_name]
            self._bind_field(field_name, field_obj)
            fields_dict[field_name] = field_obj

        load_fields, dump_fields = self.dict_class(), self.dict_class()
        for field_name, field_obj in fields_dict.items():
            if not field_obj.dump_only:
                load_fields[field_name] = field_obj
            if not field_obj.load_only:
                dump_fields[field_name] = field_obj

        dump_data_keys = [
            field_obj.data_key if field_obj.data_key is not None else name
            for name, field_obj in dump_fields.items()
        ]
        if len(dump_data_keys) != len(set(dump_data_keys)):
            data_keys_duplicates = {
                x for x in dump_data_keys if dump_data_keys.count(x) > 1
            }
            raise ValueError(
                "The data_key argument for one or more fields collides "
                "with another field's name or data_key argument. "
                "Check the following field names and "
                f"data_key arguments: {list(data_keys_duplicates)}"
            )
        load_attributes = [obj.attribute or name for name, obj in load_fields.items()]
        if len(load_attributes) != len(set(load_attributes)):
            attributes_duplicates = {
                x for x in load_attributes if load_attributes.count(x) > 1
            }
            raise ValueError(
                "The attribute argument for one or more fields collides "
                "with another field's name or attribute argument. "
                "Check the following field names and "
                f"attribute arguments: {list(attributes_duplicates)}"
            )

        self.fields = fields_dict
        self.dump_fields = dump_fields
        self.load_fields = load_fields

```

---

## Claude 응답

<!-- Claude가 여기에 응답을 작성 -->
