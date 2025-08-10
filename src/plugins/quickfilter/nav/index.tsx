import type { EntityToGroup } from '@payloadcms/ui/shared'
import type {
  Field,
  NavPreferences,
  PayloadRequest,
  SanitizedPermissions,
  SelectField,
  ServerProps,
  UIField,
} from 'payload'

import { Logout } from '@payloadcms/ui'
import { RenderServerComponent } from '@payloadcms/ui/elements/RenderServerComponent'
import { EntityType, groupNavItems } from '@payloadcms/ui/shared'
import React from 'react'
import { formatAdminURL } from 'payload/shared'
import { parseWhereClauseToFilterValues } from '../'
import type { FilterDetaild } from '../filters/types/filters-type'
import type { SupportedLocale } from '../labels'

import { NavHamburger } from './NavHamburger/index.js'
import { NavWrapper } from './NavWrapper/index.js'
import './index.scss'

const baseClass = 'nav'

import { getNavPrefs } from './getNavPrefs.js'
import { DefaultNavClient } from './index.client.js'
import { FieldAffectingData } from 'payload'

export type NavProps = {
  req?: PayloadRequest
} & ServerProps

export const DefaultNav: React.FC<NavProps> = async (props) => {
  const {
    documentSubViewType,
    i18n,
    locale,
    params,
    payload,
    permissions,
    req,
    searchParams,
    user,
    viewType,
    visibleEntities,
  } = props

  if (!payload?.config) {
    return null
  }

  const {
    admin: {
      components: { afterNavLinks, beforeNavLinks, logout },
    },
    collections,
    globals,
  } = payload.config

  const groups = groupNavItems(
    [
      ...collections
        .filter(({ slug }) => visibleEntities?.collections.includes(slug))
        .map(
          (collection) =>
            ({
              type: EntityType.collection,
              entity: collection,
            }) satisfies EntityToGroup,
        ),
      ...globals
        .filter(({ slug }) => visibleEntities?.globals.includes(slug))
        .map(
          (global) =>
            ({
              type: EntityType.global,
              entity: global,
            }) satisfies EntityToGroup,
        ),
    ],
    permissions as SanitizedPermissions,
    i18n,
  )

  const navPreferences = await getNavPrefs(req as PayloadRequest)

  // Process collections to calculate URLs with defaultFilter
  const processedGroups = groups.map(group => {
    const processedEntities = group.entities.map(entity => {
      if (entity.type === EntityType.collection) {
        const collection = collections.find(c => c.slug === entity.slug);

        // Check if collection has defaultFilter in custom props
        if (collection?.custom?.defaultFilter) {
          // Base URL without query parameters
          const baseHref = formatAdminURL({ 
            adminRoute: payload.config.routes.admin, 
            path: `/collections/${entity.slug}` 
          });

          // Get the fields from the collection for parsing the where clause
          const fields: FilterDetaild[] =
            collection.custom.filterList
              ?.flat()
              .map((field: { name: any; width: string | undefined }) => {
                const fieldName = field.name
                const fieldConfig = collection.fields.find(
                  (f) => (f as FieldAffectingData).name === fieldName,
                )
                return {
                  name: fieldName,
                  type: fieldConfig?.type,
                  options: (fieldConfig as  SelectField )?.options,
                  label: (fieldConfig as UIField)?.label || fieldName,
                  row: 0,
                  width: typeof field === 'object' && 'width' in field ? field.width : undefined,
                } as FilterDetaild
              })
              .filter(Boolean) || []

          // If we have fields and a defaultFilter, calculate the URL with where clause
          if (fields.length > 0) {
            // Parse the defaultFilter to get filter values
            const filterValues = parseWhereClauseToFilterValues(
              collection.custom.defaultFilter,
              fields,
              i18n.language as SupportedLocale
            );

            // If we have filter values, add them to the URL
            if (Object.keys(filterValues).length > 0) {
              const whereParam = encodeURIComponent(JSON.stringify(collection.custom.defaultFilter));
              return {
                ...entity,
                href: `${baseHref}?where=${whereParam}`
              };
            }
          }
        }
      }
      return entity;
    });

    return {
      ...group,
      entities: processedEntities
    };
  });

  const LogoutComponent = RenderServerComponent({
    clientProps: {
      documentSubViewType,
      viewType,
    },
    Component: logout?.Button,
    Fallback: Logout,
    importMap: payload.importMap,
    serverProps: {
      i18n,
      locale,
      params,
      payload,
      permissions,
      searchParams,
      user,
    },
  })

  return (
    <NavWrapper baseClass={baseClass}>
      <nav className={`${baseClass}__wrap`}>
        {RenderServerComponent({
          clientProps: {
            documentSubViewType,
            viewType,
          },
          Component: beforeNavLinks,
          importMap: payload.importMap,
          serverProps: {
            i18n,
            locale,
            params,
            payload,
            permissions,
            searchParams,
            user,
          },
        })}
        <DefaultNavClient groups={processedGroups} navPreferences={navPreferences as NavPreferences} />
        {RenderServerComponent({
          clientProps: {
            documentSubViewType,
            viewType,
          },
          Component: afterNavLinks,
          importMap: payload.importMap,
          serverProps: {
            i18n,
            locale,
            params,
            payload,
            permissions,
            searchParams,
            user,
          },
        })}
        <div className={`${baseClass}__controls`}>{LogoutComponent}</div>
      </nav>
      <div className={`${baseClass}__header`}>
        <div className={`${baseClass}__header-content`}>
          <NavHamburger baseClass={baseClass} />
        </div>
      </div>
    </NavWrapper>
  )
}
export default DefaultNav;